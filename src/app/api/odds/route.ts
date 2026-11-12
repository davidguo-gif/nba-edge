import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = "https://api.the-odds-api.com/v4/sports/basketball_nba";
const MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_points_rebounds_assists",
];

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
  const n = name === "Los Angeles Clippers" ? "LA Clippers" : name;
  return TEAM_ABBR[n] || null;
}

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "No API key" }, { status: 400 });
  }

  try {
    // Fetch events
    const eventsUrl = `${API}/events?apiKey=${key}`;
    const eventsRes = await fetch(eventsUrl);
    if (!eventsRes.ok) {
      const txt = await eventsRes.text();
      return NextResponse.json(
        { error: `Events API: ${eventsRes.status} ${txt}` },
        { status: eventsRes.status },
      );
    }
    const events = (await eventsRes.json()).filter((e: any) => {
      const dt = new Date(e.commence_time).getTime() - Date.now();
      return (
        dt > -3 * 3600e3 &&
        dt < 36 * 3600e3 &&
        teamAbbr(e.home_team) &&
        teamAbbr(e.away_team)
      );
    });

    if (!events.length) {
      return NextResponse.json(
        { error: "No upcoming NBA games found" },
        { status: 404 },
      );
    }

    // Fetch odds for each event
    const allProps: any[] = [];
    const games: any[] = [];

    for (const ev of events) {
      const home = teamAbbr(ev.home_team);
      const away = teamAbbr(ev.away_team);
      games.push({
        id: games.length,
        home,
        away,
        time: new Date(ev.commence_time).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        live: true,
      });

      const oddsUrl = `${API}/events/${ev.id}/odds?apiKey=${key}&regions=us&markets=${MARKETS.join(",")}&oddsFormat=american`;
      const oddsRes = await fetch(oddsUrl);
      if (!oddsRes.ok) continue;

      const data = await oddsRes.json();
      const acc: Record<string, any> = {};

      data.bookmakers.forEach((bk: any) => {
        bk.markets.forEach((m: any) => {
          const mkMap: Record<string, string> = {
            player_points: "pts",
            player_rebounds: "reb",
            player_assists: "ast",
            player_threes: "fg3",
            player_points_rebounds_assists: "pra",
          };
          const mk = mkMap[m.key];
          if (!mk) return;

          m.outcomes.forEach((o: any) => {
            const k = norm(o.description) + "|" + mk;
            if (!acc[k]) acc[k] = {};
            if (!acc[k][bk.title]) {
              acc[k][bk.title] = { book: bk.title, line: o.point };
            }
            acc[k][bk.title].line = o.point;
            if (o.name === "Over") acc[k][bk.title].over = o.price;
            else if (o.name === "Under") acc[k][bk.title].under = o.price;
          });
        });
      });

      Object.entries(acc).forEach(([key, bookData]: [string, any]) => {
        const books = Object.values(bookData).filter(
          (b: any) => b.over != null && b.under != null,
        );
        if (!books.length) return;
        const lines = books.map((b: any) => b.line).sort((a: number, b: number) => a - b);
        allProps.push({
          market: key.split("|")[1],
          line: lines[Math.floor((lines.length - 1) / 2)],
          books,
        });
      });
    }

    return NextResponse.json({
      ts: Date.now(),
      games,
      props: allProps,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}