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
  pos: string;
  pts: number;
  reb: number;
  ast: number;
  fg3: number;
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

export interface Bet {
  id: number | string;
  date: string;
  desc: string;
  book: string;
  odds: number;
  units: number;
  result: "pending" | "win" | "loss" | "push";
}

export type Markets = "pts" | "reb" | "ast" | "fg3" | "pra";

export const MARKET_NAMES: Record<Markets, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  fg3: "3PM",
  pra: "PRA",
};

export const MARKET_LABELS: Record<Markets, string> = {
  pts: "Points",
  reb: "Rebounds",
  ast: "Assists",
  fg3: "3-Pointers",
  pra: "Pts+Reb+Ast",
};

export const POSITIONS = ["G", "W", "C"];
export const STATS_MARKETS: Markets[] = ["pts", "reb", "ast", "fg3"];
export const ALL_MARKETS: Markets[] = ["pts", "reb", "ast", "fg3", "pra"];

export const BOOKS = [
  "DraftKings", "FanDuel", "BetMGM", "Caesars", "ESPN BET", "Fanatics",
];

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