import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SGO_API = "https://api.sportsgameodds.com/v2/events";

/** Map SGO stat IDs to our internal market keys. */
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

/** Map SGO bookmakerID to human-readable names. */
const BOOK_NAME: Record<string, string> = {
  pinnacle: "Pinnacle (PS3838)",
  draftkings: "DraftKings",
  draftkingspredictions: "DraftKings Predictions",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  espnbet: "ESPN BET",
  fanatics: "Fanatics",
  circa: "Circa",
  kalshi: "Kalshi",
  polymarket: "Polymarket",
  novig: "Novig",
  prophetx: "ProphetX",
  bookmaker: "Bookmaker",
  bovada: "Bovada",
  unibet: "Unibet",
  pointsbet: "PointsBet",
  williamhill: "William Hill",
};

const TEAM_ABBR: Record<string, string> = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "LA Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
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

/** Extract player name from a statEntityID like "LEBRON_JAMES_1_NBA" */
function playerNameFromEntity(eid: string): string {
  const parts = eid.split("_");
  // Remove trailing number and league code
  while (parts.length && /^\d+$/.test(parts[parts.length - 1] || "")
      || ["NBA", "NFL", "MLB", "NHL"].includes(parts[parts.length - 1] || "")) {
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
    const eventsUrl = `${SGO_API}?apiKey=${key}&leagueID=NBA&oddsAvailable=true&finalized=false&includeAltLines=false&limit=10`;
    const res = await fetch(eventsUrl);
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `SGO API: ${res.status} ${txt}` },
        { status: res.status },
      );
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

      const odds = ev.odds || {};
      // Group props by player+market
      const acc: Record<string, {
        name: string;
        books: Record<string, { book: string; line: number; over: number | null; under: number | null }>;
      }> = {};

      Object.values(odds).forEach((odd: any) => {
        const statEntityID = odd.statEntityID || odd.playerID;
        // Skip team-level odds (statEntityID = "all", "home", "away")
        if (!statEntityID || ["all", "home", "away"].includes(statEntityID)) return;

        const statKey = odd.statID || "";
        const mk = STAT_MAP[statKey];
        if (!mk) return; // Skip non-player-prop stats

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
          const bookName = BOOK_NAME[bookId.toLowerCase()] || bookId;
          const line = info.overUnder != null ? parseFloat(info.overUnder) : null;
          const price = info.odds ? parseInt(info.odds, 10) : null;
          if (line == null || price == null) return;

          if (!acc[groupKey].books[bookName]) {
            acc[groupKey].books[bookName] = { book: bookName, line, over: null, under: null };
          }
          if (isOver) acc[groupKey].books[bookName].over = price;
          if (isUnder) acc[groupKey].books[bookName].under = price;
          if (!isOver && !isUnder) {
            // fallback: if we can't tell over/under from sideID, check oddID pattern
            if (odd.opposingOddID) acc[groupKey].books[bookName].over = price;
          }
        });
      });

      // Flatten into our prop format
      Object.entries(acc).forEach(([key, entry]) => {
        const books = Object.values(entry.books).filter((b) => b.over != null && b.under != null);
        if (!books.length) return;
        const lines = books.map((b) => b.line).sort((a, b) => a - b);
        allProps.push({
          name: entry.name,
          team: [home, away],
          market: key.split("|")[1],
          line: lines[Math.floor((lines.length - 1) / 2)],
          books,
        });
      });
    }

    // Fallback: also try the prediction market endpoint for Kalshi/Polymarket/Novig
    try {
      const pmUrl = `${SGO_API}?apiKey=${key}&leagueID=NBA&oddsAvailable=true&finalized=false&includeAltLines=false&bookmakerID=polymarket,kalshi,novig&limit=5`;
      const pmRes = await fetch(pmUrl);
      if (pmRes.ok) {
        const pmData = await pmRes.json();
        const pmEvents = pmData.data || pmData.events || [];
        for (const ev of pmEvents) {
          const homeName = ev.teams?.home?.names?.long;
          const awayName = ev.teams?.away?.names?.long;
          if (!homeName || !awayName) continue;
          const home = teamAbbr(homeName);
          const away = teamAbbr(awayName);
          if (!home || !away) continue;

          const odds = ev.odds || {};
          Object.values(odds).forEach((odd: any) => {
            const statEntityID = odd.statEntityID || odd.playerID;
            if (!statEntityID || ["all", "home", "away"].includes(statEntityID)) return;
            const statKey = odd.statID || "";
            const mk = STAT_MAP[statKey];
            if (!mk) return;

            const player = playerNameFromEntity(statEntityID);
            const groupKey = norm(player) + "|" + mk;
            const existing = allProps.find(
              (p) => norm(p.name) === norm(player) && p.market === mk,
            );
            if (!existing) {
              allProps.push({
                name: player,
                team: [home, away],
                market: mk,
                line: 0,
                books: [],
              });
            }
            const target = existing || allProps[allProps.length - 1];

            const isOver = odd.sideID === "over" || odd.oddID?.endsWith("-over");
            const isUnder = odd.sideID === "under" || odd.oddID?.endsWith("-under");

            const byBook = odd.byBookmaker || {};
            Object.entries(byBook).forEach(([bookId, info]: [string, any]) => {
              if (!info.available) return;
              const bookName = BOOK_NAME[bookId.toLowerCase()] || bookId;
              const line = info.overUnder ? parseFloat(info.overUnder) : null;
              const price = info.odds ? parseInt(info.odds, 10) : null;
              if (line == null || price == null) return;

              let existingBook = target.books.find((b: any) => b.book === bookName);
              if (!existingBook) {
                existingBook = { book: bookName, line, over: null, under: null };
                target.books.push(existingBook);
              }
              if (isOver) existingBook.over = price;
              if (isUnder) existingBook.under = price;
              if (!isOver && !isUnder) existingBook.over = price;
            });
          });
        }

        // Recalculate median lines after adding PM books
        allProps.forEach((p) => {
          const valid = p.books.filter((b: any) => b.over != null && b.under != null);
          if (valid.length) {
            const lines = valid.map((b: any) => b.line).sort((a: number, b: number) => a - b);
            p.line = lines[Math.floor((lines.length - 1) / 2)];
          }
        });
      }
    } catch { /* prediction market fallback is optional */ }

    return NextResponse.json({
      ts: Date.now(),
      source: "sgo",
      games,
      props: allProps,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}