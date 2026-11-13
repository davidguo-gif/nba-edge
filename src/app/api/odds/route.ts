import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API = "https://api.the-odds-api.com/v4/sports/basketball_nba";
const MAIN_MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_points_rebounds_assists",
  "player_points_assists",
  "player_points_rebounds",
  "player_rebounds_assists",
  "player_steals",
  "player_blocks",
  "player_turnovers",
  "player_blocks_steals",
  "player_double_double",
  "player_triple_double",
];

const QUARTER_MARKETS = [
  "player_q1_points",
  "player_q1_rebounds",
  "player_q1_assists",
  "player_q2_points",
  "player_q2_rebounds",
  "player_q2_assists",
  "player_q3_points",
  "player_q3_rebounds",
  "player_q3_assists",
  "player_q4_points",
  "player_q4_rebounds",
  "player_q4_assists",
];

/**
 * The Odds API bookmaker keys. Sharp books (US exchanges + Pinnacle in the EU region) are
 * only used to estimate the true probability; the retail books are what you actually bet at.
 */
const SHARP: Record<string, string> = {
  pinnacle: "Pinnacle",
  kalshi: "Kalshi",
  novig: "Novig",
  polymarket: "Polymarket",
  prophetx: "ProphetX",
};
const RETAIL: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  williamhill_us: "Caesars",
  espnbet: "theScore Bet",
  fanatics: "Fanatics",
  betrivers: "BetRivers",
  hardrockbet: "Hard Rock Bet",
  ballybet: "Bally Bet",
  betparx: "betPARX",
};
// us/us2 = retail books, us_ex = Kalshi/Novig/Polymarket/ProphetX, eu = Pinnacle
const REGIONS = "us,us2,us_ex,eu";

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
        dt < 48 * 3600e3 &&
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
        dt: ev.commence_time,
        live: true,
      });

      const MK_MAP: Record<string, string> = {
        player_points: "pts",
        player_rebounds: "reb",
        player_assists: "ast",
        player_threes: "fg3",
        player_points_rebounds_assists: "pra",
        player_points_assists: "pts_ast",
        player_points_rebounds: "pts_reb",
        player_rebounds_assists: "reb_ast",
        player_steals: "stl",
        player_blocks: "blk",
        player_turnovers: "tov",
        player_blocks_steals: "blk_stl",
        player_double_double: "dd",
        player_triple_double: "td",
        // quarter markets
        player_q1_points: "q1_pts",
        player_q1_rebounds: "q1_reb",
        player_q1_assists: "q1_ast",
        player_q2_points: "q2_pts",
        player_q2_rebounds: "q2_reb",
        player_q2_assists: "q2_ast",
        player_q3_points: "q3_pts",
        player_q3_rebounds: "q3_reb",
        player_q3_assists: "q3_ast",
        player_q4_points: "q4_pts",
        player_q4_rebounds: "q4_reb",
        player_q4_assists: "q4_ast",
      };

      // Fetch main markets and quarter markets separately so quarter failures don't kill everything
      const marketGroups = [
        { markets: MAIN_MARKETS, group: "main" },
        { markets: QUARTER_MARKETS, group: "quarter" },
      ];

      const acc: Record<string, { retail: Record<string, any>; sharp: Record<string, any> }> = {};
      const names: Record<string, string> = {};

      for (const { markets, group } of marketGroups) {
        // quarter props are only priced by US retail books, so don't pay for the other regions
        const regions = group === "main" ? REGIONS : "us";
        const oddsUrl = `${API}/events/${ev.id}/odds?apiKey=${key}&regions=${regions}&markets=${markets.join(",")}&oddsFormat=american`;
        const oddsRes = await fetch(oddsUrl);
        if (!oddsRes.ok) continue;

        const data = await oddsRes.json();

        data.bookmakers.forEach((bk: any) => {
          const sharpName = SHARP[bk.key];
          const retailName = RETAIL[bk.key];
          const name = sharpName || retailName;
          if (!name) return; // DFS apps, offshore books, other regions
          const side = sharpName ? "sharp" : "retail";
          bk.markets.forEach((m: any) => {
            const mk = MK_MAP[m.key];
            if (!mk) return;

            m.outcomes.forEach((o: any) => {
              const k = norm(o.description) + "|" + mk;
              if (!acc[k]) acc[k] = { retail: {}, sharp: {} };
              names[k] = o.description;
              const book = acc[k][side][name] || (acc[k][side][name] = { book: name, line: o.point });
              book.line = o.point;
              if (o.name === "Over") book.over = o.price;
              else if (o.name === "Under") book.under = o.price;
            });
          });
        });
      }

      Object.entries(acc).forEach(([key, bookData]) => {
        const complete = (m: Record<string, any>) =>
          Object.values(m).filter((b: any) => b.over != null && b.under != null);
        const books = complete(bookData.retail);
        if (!books.length) return; // nothing to bet at
        const sharp = complete(bookData.sharp);
        const lines = books.map((b: any) => b.line).sort((a: number, b: number) => a - b);
        allProps.push({
          name: names[key],
          team: [home, away],
          market: key.split("|")[1],
          line: lines[Math.floor((lines.length - 1) / 2)],
          books,
          sharp,
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