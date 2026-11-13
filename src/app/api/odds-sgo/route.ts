import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = "https://api.sportsgameodds.com/v2/events";

/** Map stat IDs to our internal market keys. */
const STAT_MAP: Record<string, string> = {
  points: "pts",
  rebounds: "reb",
  assists: "ast",
  "three-pointers": "fg3",
  "points+rebounds+assists": "pra",
  "points+assists": "pts_ast",
  "points+rebounds": "pts_reb",
  "rebounds+assists": "reb_ast",
  steals: "stl",
  blocks: "blk",
  turnovers: "tov",
  "blocks+steals": "blk_stl",
  "double-double": "dd",
  "triple-double": "td",
};

/** Map SGO bookmakerID to the canonical name our SHARP_BOOK_WEIGHTS expects. */
const SHARP_BOOK_IDS = ["kalshi", "polymarket", "novig"];
const BOOK_NAME: Record<string, string> = {
  kalshi: "Kalshi",
  polymarket: "Polymarket",
  novig: "Novig",
};

const TEAM_ABBR: Record<string, string> = {
  "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
  "LA Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP", "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR", "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

function teamAbbr(name: string): string | null {
  return TEAM_ABBR[name] || null;
}

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();
}

function playerNameFromEntity(eid: string): string {
  const parts = eid.split("_");
  while (parts.length && (/^\d+$/.test(parts[parts.length - 1]) ||
      ["NBA", "NFL", "MLB", "NHL"].includes(parts[parts.length - 1]))) {
    parts.pop();
  }
  return parts.join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "No API key" }, { status: 400 });
  }

  try {
    // Only fetch sharp/prediction-market books (Kalshi, Polymarket, Novig)
    const url = `${API}?apiKey=${key}&leagueID=NBA&oddsAvailable=true&finalized=false&includeAltLines=false&bookmakerID=${SHARP_BOOK_IDS.join(",")}&limit=10`;
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Sharp books API: ${res.status} ${txt}` }, { status: res.status });
    }

    const data = await res.json();
    const events = data.data || data.events || [];

    const allProps: any[] = [];
    const games: any[] = [];

    for (const ev of events) {
      const homeName = ev.teams?.home?.names?.long;
      const awayName = ev.teams?.away?.names?.long;
      if (!homeName || !awayName) continue;
      const home = teamAbbr(homeName);
      const away = teamAbbr(awayName);
      if (!home || !away) continue;

      if (!games.find((g) => g.home === home && g.away === away)) {
        games.push({
          id: games.length,
          home,
          away,
          time: ev.status?.startsAt
            ? new Date(ev.status.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "",
          dt: ev.status?.startsAt || "",
          live: (ev.status?.started && !ev.status?.ended) || false,
        });
      }

      const odds = ev.odds || {};
      const acc: Record<string, any> = {};

      Object.values(odds).forEach((odd: any) => {
        const statEntityID = odd.statEntityID || odd.playerID;
        if (!statEntityID || ["all", "home", "away"].includes(statEntityID)) return;
        const statKey = odd.statID || "";
        const mk = STAT_MAP[statKey];
        if (!mk) return;

        const player = playerNameFromEntity(statEntityID);
        const groupKey = norm(player) + "|" + mk;
        if (!acc[groupKey]) {
          acc[groupKey] = { name: player, books: {} };
        }

        const isOver = odd.sideID === "over" || odd.oddID?.endsWith("-over");
        const isUnder = odd.sideID === "under" || odd.oddID?.endsWith("-under");

        const byBook = odd.byBookmaker || {};
        Object.entries(byBook).forEach(([bookId, info]: [string, any]) => {
          if (!info.available) return;
          const bookName = BOOK_NAME[bookId.toLowerCase()];
          if (!bookName) return; // only include known sharp books
          const line = info.overUnder != null ? parseFloat(info.overUnder) : null;
          const price = info.odds ? parseInt(info.odds, 10) : null;
          if (line == null || price == null) return;

          if (!acc[groupKey].books[bookName]) {
            acc[groupKey].books[bookName] = { book: bookName, line, over: null, under: null };
          }
          if (isOver) acc[groupKey].books[bookName].over = price;
          if (isUnder) acc[groupKey].books[bookName].under = price;
        });
      });

      Object.entries(acc).forEach(([key, entry]: [string, any]) => {
        const books = Object.values(entry.books).filter((b: any) => b.over != null && b.under != null);
        if (!books.length) return;
        const lines = books.map((b: any) => b.line).sort((a: number, b: number) => a - b);
        const target = allProps.find(
          (p) => norm(p.name) === norm(entry.name) && p.market === key.split("|")[1],
        );
        if (target) {
          books.forEach((b: any) => {
            if (!target.books.find((tb: any) => tb.book === b.book)) target.books.push(b);
          });
        } else {
          allProps.push({
            name: entry.name,
            team: [home, away],
            market: key.split("|")[1],
            line: lines[Math.floor((lines.length - 1) / 2)],
            books,
          });
        }
      });
    }

    return NextResponse.json({ ts: Date.now(), source: "sharpbooks", games, props: allProps });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}