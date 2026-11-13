export interface TeamData {
  abbr: string;
  name: string;
  ortg: number;
  drtg: number;
  pace: number;
  net: number;
  w: number;
  l: number;
  gp: number;
  ppg: number;
  oppg: number;
  home: string;
  road: string;
  l10: string;
  streak: string;
  b2bW: number;
  b2bL: number;
  b2bDrop: number;
  atsW: number | null;
  ouO: number | null;
  live: boolean;
  dm: Record<string, Record<string, number>>;
  rank: Record<string, Record<string, number>>;
  y26?: Partial<TeamData> | null;
}

export interface Player {
  id: number;
  name: string;
  team: string;
  pos: string; // grouped: G / W / C
  posRaw: string; // original from API: G, F, C, G-F, etc.
  pts: number;
  reb: number;
  ast: number;
  fg3: number;
  stl: number;
  blk: number;
  tov: number;
  min: number;
  log: GameLog[];
}

export interface GameLog {
  date: string;
  opp: string;
  home: boolean;
  b2b: boolean;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  fg3: number;
  pra: number;
}

export interface SlateGame {
  id: number;
  home: string;
  away: string;
  spread: number;
  total: number;
  pace: number;
  hRest: number;
  aRest: number;
  hFour: boolean;
  aFour: boolean;
  time: string;
  model: boolean;
  dt?: string; // ISO datetime for filtering
}

export interface ContextData {
  opp: string;
  home: boolean;
  rest: number;
  b2b: boolean;
  four: boolean;
  spread: number;
  total: number;
  gid: number;
}

export interface PropBook {
  book: string;
  line: number;
  over: number;
  under: number;
}

export interface Prop {
  id: number;
  pid: number;
  pname: string;
  market: string;
  line: number;
  proj: number;
  books: PropBook[];
}

export interface Injury {
  name: string;
  pos: string;
  return: string;
  status: string;
  note: string;
}

export type TeamListEntry = [string, string];

export interface NBAData {
  generated: string;
  season: string;
  source: string;
  rows: any[][];
  prev: any[][];
  pl: Record<string, [string, string]>;
  slate: { date: string; games: { home: string; away: string; dt?: string; status?: string }[] };
  injuries: Record<string, Injury[]>;
  adv?: Record<string, { pace: number; ortg: number; drtg: number; net: number }>;
}

export interface SyncedInfo {
  ts: number;
  last: string;
  games: number;
  players: number;
  rows: number;
}

/** One leg of a parlay. Game legs (spread / totals) and player-prop legs share this shape. */
export interface ParlayLeg {
  id: string;
  gameId: number | null; // index into SLATE
  game: string; // "SAS @ OKC"
  kind: "spread" | "total" | "teamtotal" | "prop";
  side: "over" | "under" | "cover"; // cover = team wins the spread
  team?: string; // spread: team backed; team total / prop: that team
  player?: string;
  pos?: string;
  market?: string;
  line?: number | null;
  label: string;
  odds: number; // American
  book?: string;
}

export interface Bet {
  id: number | string;
  date: string;
  desc: string;
  book: string;
  odds: number;
  units: number;
  result: "pending" | "win" | "loss" | "push";
  note?: string;
}

export type Markets =
  | "pts" | "reb" | "ast" | "fg3"
  | "pra" | "pts_ast" | "pts_reb" | "reb_ast"
  | "stl" | "blk" | "tov"
  | "blk_stl"
  | "dd" | "td"
  | "fg_pct" | "ft_pct"
  // quarter props
  | "q1_pts" | "q1_reb" | "q1_ast"
  | "q2_pts" | "q2_reb" | "q2_ast"
  | "q3_pts" | "q3_reb" | "q3_ast"
  | "q4_pts" | "q4_reb" | "q4_ast";

export const MARKET_NAMES: Record<string, string> = {
  pts: "PTS", reb: "REB", ast: "AST", fg3: "3PM", pra: "PRA",
  pts_ast: "PTS+AST", pts_reb: "PTS+REB", reb_ast: "REB+AST",
  stl: "STL", blk: "BLK", tov: "TOV", blk_stl: "BLK+STL",
  dd: "D/D", td: "T/D",
  fg_pct: "FG%", ft_pct: "FT%",
  q1_pts: "Q1 PTS", q1_reb: "Q1 REB", q1_ast: "Q1 AST",
  q2_pts: "Q2 PTS", q2_reb: "Q2 REB", q2_ast: "Q2 AST",
  q3_pts: "Q3 PTS", q3_reb: "Q3 REB", q3_ast: "Q3 AST",
  q4_pts: "Q4 PTS", q4_reb: "Q4 REB", q4_ast: "Q4 AST",
};

export const MARKET_LABELS: Record<string, string> = {
  pts: "Points", reb: "Rebounds", ast: "Assists", fg3: "3-Pointers", pra: "Points+Reb+Ast",
  pts_ast: "Points+Assists", pts_reb: "Points+Rebounds", reb_ast: "Rebounds+Assists",
  stl: "Steals", blk: "Blocks", tov: "Turnovers", blk_stl: "Blocks+Steals",
  dd: "Double-Double", td: "Triple-Double",
  fg_pct: "FG%", ft_pct: "FT%",
  q1_pts: "Q1 Points", q1_reb: "Q1 Rebounds", q1_ast: "Q1 Assists",
  q2_pts: "Q2 Points", q2_reb: "Q2 Rebounds", q2_ast: "Q2 Assists",
  q3_pts: "Q3 Points", q3_reb: "Q3 Rebounds", q3_ast: "Q3 Assists",
  q4_pts: "Q4 Points", q4_reb: "Q4 Rebounds", q4_ast: "Q4 Assists",
};

/** Stats that come from the box-score columns (indexable by k). */
export const STATS_MARKETS: Markets[] = ["pts", "reb", "ast", "fg3", "stl", "blk", "tov"];

/** Reading box-score column index for each stat. */
export const STAT_IDX: Record<string, number> = { pts: 8, reb: 9, ast: 10, fg3: 11, stl: 12, blk: 13, tov: 15 };

/** Markets we can compute the player average for. */
export const AVG_MARKETS: string[] = [
  "pts", "reb", "ast", "fg3", "stl", "blk", "tov",
  "pra", "pts_ast", "pts_reb", "reb_ast", "blk_stl",
];

export const ALL_MARKETS: Markets[] = [
  "pts", "reb", "ast", "fg3", "stl", "blk", "tov",
  "pra", "pts_ast", "pts_reb", "reb_ast", "blk_stl",
  "dd", "td",
];

/* ---------- positions ---------- */
export const POSITIONS = ["G", "W", "C"];

/** Map raw position string (from nba_api) to a full display label. */
export const POS_LABEL: Record<string, string> = {
  G: "Guard", F: "Forward", C: "Center",
  "G-F": "Combo Guard", "F-G": "Point Forward",
  "F-C": "Forward-Center", "C-F": "Center-Forward",
};

/** Group raw position for defense-vs-position stats. */
export const posGroup = (p: string): string =>
  p === "G" || p === "G-F" ? "G" : p === "C" || p === "C-F" ? "C" : "W";

export const BOOKS = [
  "DraftKings", "FanDuel", "BetMGM", "Caesars", "ESPN BET", "Fanatics",
];

/**
 * Sharp book weights for weighted-consensus EV calculation (sums to 100%).
 * Currently normalized for books available via predictionmarketapi.com.
 * When integrating additional APIs, add entries here and the consensusProb()
 * function will automatically include them.
 */
export const SHARP_BOOK_WEIGHTS: Record<string, number> = {
  kalshi: 51.5,
  polymarket: 24.25,
  novig: 24.25,
};

/** Map short/normalized book names to their canonical label. */
export const SHARP_BOOK_ALIAS: Record<string, string> = {
  pinnacle: "Pinnacle (PS3838)",
  draftkingspredictions: "DraftKings Predictions",
  kalshi: "Kalshi",
  bookmaker: "Bookmaker",
  circa: "Circa",
  novig: "Novig",
  polymarket: "Polymarket",
  prophetx: "ProphetX",
};

/** Weighted sharp consensus — which books contribute to the EV true-probability. */
export const CONSENSUS_DESCRIPTION = "Sharp consensus (Kalshi 51.5%, Polymarket 24.25%, Novig 24.25%)";

export const BOOK_URLS: Record<string, string> = {
  DraftKings: "https://sportsbook.draftkings.com",
  FanDuel: "https://sportsbook.fanduel.com",
  BetMGM: "https://sports.betmgm.com",
  Caesars: "https://sportsbook.caesars.com",
  "ESPN BET": "https://espnbet.com",
  Fanatics: "https://fanatics.com/sportsbook",
};

export const TEAM_LIST: TeamListEntry[] = [
  ["ATL", "Atlanta Hawks"],
  ["BOS", "Boston Celtics"],
  ["BKN", "Brooklyn Nets"],
  ["CHA", "Charlotte Hornets"],
  ["CHI", "Chicago Bulls"],
  ["CLE", "Cleveland Cavaliers"],
  ["DAL", "Dallas Mavericks"],
  ["DEN", "Denver Nuggets"],
  ["DET", "Detroit Pistons"],
  ["GSW", "Golden State Warriors"],
  ["HOU", "Houston Rockets"],
  ["IND", "Indiana Pacers"],
  ["LAC", "LA Clippers"],
  ["LAL", "Los Angeles Lakers"],
  ["MEM", "Memphis Grizzlies"],
  ["MIA", "Miami Heat"],
  ["MIL", "Milwaukee Bucks"],
  ["MIN", "Minnesota Timberwolves"],
  ["NOP", "New Orleans Pelicans"],
  ["NYK", "New York Knicks"],
  ["OKC", "Oklahoma City Thunder"],
  ["ORL", "Orlando Magic"],
  ["PHI", "Philadelphia 76ers"],
  ["PHX", "Phoenix Suns"],
  ["POR", "Portland Trail Blazers"],
  ["SAC", "Sacramento Kings"],
  ["SAS", "San Antonio Spurs"],
  ["TOR", "Toronto Raptors"],
  ["UTA", "Utah Jazz"],
  ["WAS", "Washington Wizards"],
];

export const TEAM_MAP: Record<string, string> = Object.fromEntries(
  TEAM_LIST.map(([a, n]) => [n, a])
);