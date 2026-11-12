import type {
  TeamData,
  Player,
  SlateGame,
  ContextData,
  Prop,
  PropBook,
  SyncedInfo,
  NBAData,
  Injury,
} from "@/types";
import { TEAM_LIST, POSITIONS, STATS_MARKETS, ALL_MARKETS, BOOKS } from "@/types";

/* ---------- state ---------- */
export interface AppState {
  T: Record<string, TeamData>;
  TEAM_LIST: [string, string][];
  PLAYERS: Player[];
  SLATE: SlateGame[];
  CTX: Record<string, ContextData>;
  PROPS: Prop[];
  BOOKS: string[];
  POS: string[];
  MARKETS: string[];
  injuries: Record<string, Injury[]>;
  synced: SyncedInfo | null;
  standings: { ts: number } | null;
  live: { ts: number; remaining: number } | null;
}

export function createState(): AppState {
  const T: Record<string, TeamData> = {};
  TEAM_LIST.forEach(([ab, name]) => {
    const dm: Record<string, Record<string, number>> = {};
    POSITIONS.forEach((p) => {
      dm[p] = {};
      STATS_MARKETS.forEach((s) => { dm[p][s] = 1; });
      dm[p].pra = 1;
    });
    const rank: Record<string, Record<string, number>> = {};
    POSITIONS.forEach((p) => {
      rank[p] = {};
      ALL_MARKETS.forEach((m) => { rank[p][m] = 15; });
    });
    T[ab] = {
      abbr: ab,
      name,
      ortg: 114,
      drtg: 114,
      pace: 100,
      net: 0,
      w: 0,
      l: 0,
      gp: 0,
      ppg: 0,
      oppg: 0,
      home: "-",
      road: "-",
      l10: "-",
      streak: "-",
      b2bW: 0,
      b2bL: 0,
      b2bDrop: 0,
      atsW: null,
      ouO: null,
      live: true,
      dm,
      rank,
    };
  });
  return {
    T,
    TEAM_LIST,
    PLAYERS: [],
    SLATE: [],
    CTX: {},
    PROPS: [],
    BOOKS,
    POS: POSITIONS,
    MARKETS: ALL_MARKETS,
    injuries: {},
    synced: null,
    standings: null,
    live: null,
  };
}

/* ---------- fetch NBA data from our API ---------- */
let cachedData: NBAData | null = null;

export async function fetchNBAData(): Promise<NBAData> {
  if (cachedData) return cachedData;
  const res = await fetch("/api/data");
  if (!res.ok) throw new Error("Failed to fetch NBA data: " + res.statusText);
  cachedData = await res.json();
  return cachedData!;
}

export function clearCache() {
  cachedData = null;
}

/* ---------- data processing ---------- */
const CUTOFF = "2026-01-01";
const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const addDays = (d: string, n: number) =>
  new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const dayNum = (d: string) => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);
const posGroup = (p: string) =>
  p === "G" || p === "G-F" ? "G" : p === "C" || p === "C-F" ? "C" : "W";

function baseRows(S: NBAData): any[][] {
  return S.rows ? S.rows.concat(S.prev || []) : [];
}

function teamStats(
  rows: any[][],
  teamKeys: string[],
): Record<string, any> {
  const tg: Record<string, any> = {};
  rows.forEach((r: any[]) => {
    const key = r[1] + "|" + r[3];
    if (!tg[key]) {
      tg[key] = {
        gid: r[1],
        date: r[2],
        tm: r[3],
        opp: r[4],
        home: r[5],
        pts: 0,
        fga: 0,
        fta: 0,
        oreb: 0,
        tov: 0,
        min: 0,
      };
    }
    const t = tg[key];
    t.pts += r[8];
    t.fga += r[12];
    t.fta += r[13];
    t.oreb += r[14];
    t.tov += r[15];
    t.min += r[7];
  });
  const TS: Record<string, any[]> = {};
  Object.values(tg).forEach((t: any) => {
    const o = tg[t.gid + "|" + t.opp];
    if (!o) return;
    const poss =
      (t.fga + 0.44 * t.fta - t.oreb + t.tov +
        (o.fga + 0.44 * o.fta - o.oreb + o.tov)) / 2;
    if (!TS[t.tm]) TS[t.tm] = [];
    TS[t.tm].push({
      date: t.date,
      home: t.home,
      pts: t.pts,
      opp: o.pts,
      poss,
      gm: t.min / 5,
    });
  });
  const stats: Record<string, any> = {};
  teamKeys.forEach((ab) => {
    const g = (TS[ab] || []).sort((a: any, b: any) =>
      a.date < b.date ? -1 : 1,
    );
    if (!g.length) {
      stats[ab] = null;
      return;
    }
    const sum = (k: string) => g.reduce((s: number, x: any) => s + x[k], 0);
    const poss = sum("poss");
    const gm = sum("gm");
    const wins = g.filter((x: any) => x.pts > x.opp);
    let b2bW = 0,
      b2bL = 0,
      bm: number[] = [],
      nm: number[] = [],
      streak = 0;
    g.forEach((x: any, i: number) => {
      const b2b =
        i > 0 && dayNum(x.date) - dayNum(g[i - 1].date) === 1;
      const mg = x.pts - x.opp;
      if (b2b) {
        bm.push(mg);
        mg > 0 ? b2bW++ : b2bL++;
      } else nm.push(mg);
    });
    for (let i = g.length - 1; i >= 0; i--) {
      const w = g[i].pts > g[i].opp;
      if (i === g.length - 1) streak = w ? 1 : -1;
      else if ((streak > 0) === w) streak += streak > 0 ? 1 : -1;
      else break;
    }
    const mean = (a: number[]) =>
      a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
    const l10 = g.slice(-10);
    const l10w = l10.filter((x: any) => x.pts > x.opp).length;
    stats[ab] = {
      w: wins.length,
      l: g.length - wins.length,
      gp: g.length,
      pace: (poss * 48) / gm,
      ortg: (100 * sum("pts")) / poss,
      drtg: (100 * sum("opp")) / poss,
      ppg: sum("pts") / g.length,
      oppg: sum("opp") / g.length,
      l10: `${l10w}-${l10.length - l10w}`,
      streak: (streak > 0 ? "W" : "L") + Math.abs(streak),
      b2bW,
      b2bL,
      b2bDrop: +(mean(nm) - mean(bm)).toFixed(1),
    };
    stats[ab].net = stats[ab].ortg - stats[ab].drtg;
  });
  Object.defineProperty(stats, "__games", { value: TS, enumerable: false });
  return stats;
}

function TS_HR(
  ab: string,
  TS: Record<string, any[]>,
  homeFlag: boolean,
): string {
  const g = (TS[ab] || []).filter((x: any) => x.home === (homeFlag ? 1 : 0));
  const w = g.filter((x: any) => x.pts > x.opp).length;
  return `${w}-${g.length - w}`;
}

export function processData(S: NBAData, state: AppState): void {
  const rows = baseRows(S);
  const today = todayET();
  const teamKeys = Object.keys(state.T);

  // compute all-team stats + y26
  // records (W-L, home/road, L10, streak, B2B) use the current season only;
  // ratings/pace keep the blended sample from last season.
  const curRows = S.rows || [];
  const TSall = teamStats(rows, teamKeys);
  const TSy26 = teamStats(curRows, teamKeys);

  teamKeys.forEach((ab) => {
    const t = state.T[ab];
    const s = TSall[ab];
    if (!s) {
      Object.assign(t, {
        gp: 0,
        pace: 100,
        ortg: 114,
        drtg: 114,
        net: 0,
        ppg: 0,
        oppg: 0,
        w: 0,
        l: 0,
        l10: "-",
        streak: "-",
        b2bW: 0,
        b2bL: 0,
        b2bDrop: 0,
      });
      return;
    }
    Object.assign(t, s);
    const c = TSy26[ab];
    Object.assign(t, {
      w: c ? c.w : 0,
      l: c ? c.l : 0,
      gp: c ? c.gp : 0,
      l10: c ? c.l10 : "-",
      streak: c ? c.streak : "-",
      b2bW: c ? c.b2bW : 0,
      b2bL: c ? c.b2bL : 0,
      b2bDrop: c ? c.b2bDrop : 0,
    });
    t.home = TS_HR(ab, (TSy26 as any).__games, true);
    t.road = TS_HR(ab, (TSy26 as any).__games, false);
    t.y26 = c;
    // official NBA.com pace / ratings for the current season override the box-score estimate
    const a = S.adv && S.adv[ab];
    if (a) Object.assign(t, a);
  });

  // defense versus position
  const K = ["pts", "reb", "ast", "fg3"];
  const IDX: Record<string, number> = { pts: 8, reb: 9, ast: 10, fg3: 11 };
  const DV: Record<string, Record<string, Record<string, number>>> = {};
  rows.forEach((r: any[]) => {
    const pg = posGroup((S.pl[r[6]] || [])[1] || "");
    if (!DV[r[4]]) DV[r[4]] = {};
    if (!DV[r[4]][pg]) DV[r[4]][pg] = { pts: 0, reb: 0, ast: 0, fg3: 0 };
    const d = DV[r[4]][pg];
    K.forEach((k) => {
      d[k] += r[IDX[k]];
    });
  });

  POSITIONS.forEach((p) => {
    const teams = teamKeys.filter(
      (ab) => TSall[ab] && DV[ab] && DV[ab][p],
    );
    K.forEach((k) => {
      const al: Record<string, number> = {};
      teams.forEach((ab) => {
        al[ab] = DV[ab][p][k] / TSall[ab].gp;
      });
      const vals = Object.values(al);
      const avg = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 1;
      teamKeys.forEach((ab) => {
        const gp = TSall[ab] ? TSall[ab].gp : 0;
        const raw = al[ab] != null && avg ? al[ab] / avg : 1;
        state.T[ab].dm[p][k] = 1 + ((raw - 1) * gp) / (gp + 8);
      });
    });
    teamKeys.forEach((ab) => {
      const m = state.T[ab].dm[p];
      m.pra = m.pts * 0.6 + m.reb * 0.25 + m.ast * 0.15;
    });
    ALL_MARKETS.forEach((m) => {
      const sorted = [...teamKeys].sort(
        (a, b) => state.T[a].dm[p][m] - state.T[b].dm[p][m],
      );
      sorted.forEach((ab, i) => {
        state.T[ab].rank[p][m] = i + 1;
      });
    });
  });

  // players and game logs
  const byPid: Record<string, Map<string, any[]>> = {};
  rows.forEach((r: any[]) => {
    if (!byPid[r[6]]) byPid[r[6]] = new Map();
    byPid[r[6]].set(r[0], r);
  });

  const teamDates: Record<string, string[]> = {};
  rows.forEach((r: any[]) => {
    if (!teamDates[r[3]]) teamDates[r[3]] = [];
    teamDates[r[3]].push(r[2]);
  });
  Object.keys(teamDates).forEach((ab) => {
    teamDates[ab] = [...new Set(teamDates[ab])].sort();
  });

  const list: Player[] = [];
  Object.keys(byPid).forEach((pid) => {
    const rs = Array.from(byPid[pid].values()).sort((a: any, b: any) =>
      a[2] < b[2] ? 1 : -1,
    );
    const m = S.pl[pid];
    if (!m || !rs.length) return;
    const avgMin = rs.reduce((s: number, r: any) => s + r[7], 0) / rs.length;
    if (rs.length < 3 || avgMin < 15) return;
    const mine = new Set(rs.map((r: any) => r[2]));
    const team = rs[0][3];
    if (!state.T[team]) return;
    const log = rs
      .filter((r: any) => state.T[r[4]])
      .map((r: any) => {
        const prev = addDays(r[2], -1);
        const b2b =
          mine.has(prev) || (teamDates[r[3]] || []).includes(prev);
        return {
          date: r[2],
          opp: r[4],
          home: !!r[5],
          b2b,
          min: Math.round(r[7]),
          pts: r[8],
          reb: r[9],
          ast: r[10],
          fg3: r[11],
          pra: r[8] + r[9] + r[10],
        };
      });
    const av = (k: string) =>
      log.reduce((s, g) => s + (g as any)[k], 0) / log.length;
    list.push({
      id: 0,
      name: m[0],
      team,
      pos: posGroup(m[1]),
      pts: av("pts"),
      reb: av("reb"),
      ast: av("ast"),
      fg3: av("fg3"),
      min: av("min"),
      log,
    });
  });
  list.sort((a, b) => a.name.localeCompare(b.name));
  state.PLAYERS.length = 0;
  list.forEach((p, i) => {
    p.id = i;
    state.PLAYERS.push(p);
  });

  // tonight's schedule
  state.SLATE.length = 0;
  Object.keys(state.CTX).forEach((k) => delete state.CTX[k]);
  const sl = S.slate && S.slate.date === today
    ? S.slate.games.filter((g) => state.T[g.home] && state.T[g.away])
    : [];

  const restOf = (ab: string) => {
    const ds = (teamDates[ab] || []).filter((d) => d < today);
    const last = ds[ds.length - 1];
    return {
      rest: last ? Math.min(4, dayNum(today) - dayNum(last) - 1) : 3,
      four:
        ds.filter((d) => dayNum(today) - dayNum(d) <= 4).length >= 3,
    };
  };

  sl.forEach((g, i) => {
    const H = state.T[g.home],
      A = state.T[g.away],
      hr = restOf(g.home),
      ar = restOf(g.away);
    const adj =
      (hr.rest === 0 ? -1.5 : hr.rest >= 3 ? 0.8 : 0) -
      (ar.rest === 0 ? -1.5 : ar.rest >= 3 ? 0.8 : 0);
    const spread =
      Math.round(-((H.net - A.net) * 0.45 + 2.4 + adj) * 2) / 2;
    const pace = (H.pace + A.pace) / 2;
    const total =
      Math.round(
        ((pace / 100) *
          ((H.ortg + A.drtg) / 2 + (A.ortg + H.drtg) / 2) +
          (hr.rest === 0 ? -1.2 : 0) +
          (ar.rest === 0 ? -1.2 : 0) +
          (hr.four || ar.four ? -2 : 0)) *
          2,
      ) / 2;
    const gm: SlateGame = {
      id: i,
      home: g.home,
      away: g.away,
      spread,
      total,
      pace,
      hRest: hr.rest,
      aRest: ar.rest,
      hFour: hr.four,
      aFour: ar.four,
      model: true,
      time: g.dt
        ? new Date(g.dt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })
        : g.status || "",
    };
    state.SLATE.push(gm);
    state.CTX[g.home] = {
      opp: g.away,
      home: true,
      rest: hr.rest,
      b2b: hr.rest === 0,
      four: hr.four,
      spread,
      total,
      gid: i,
    };
    state.CTX[g.away] = {
      opp: g.home,
      home: false,
      rest: ar.rest,
      b2b: ar.rest === 0,
      four: ar.four,
      spread: -spread,
      total,
      gid: i,
    };
  });

  state.PROPS.length = 0;
  const last = rows.reduce(
    (m: string, r: any) => (r[2] > m ? r[2] : m),
    "",
  );
  state.synced = {
    ts: Date.now(),
    last,
    games: Object.keys(TSall).length,
    players: list.length,
    rows: rows.length,
  };
  state.standings = { ts: state.synced.ts };
  state.injuries = S.injuries || {};
}

/* ---------- analysis ---------- */
export const windows = (pl: Player) => ({
  l10: pl.log.slice(0, 10),
  l15: pl.log.slice(0, 15),
  y26: pl.log.filter((g) => g.date >= "2026-01-01"),
});

export function hit(
  games: any[],
  k: string,
  line: number,
): { o: number; u: number; n: number; p: number } {
  let o = 0,
    u = 0;
  games.forEach((g) => {
    if (g[k] > line) o++;
    else if (g[k] < line) u++;
  });
  return {
    o,
    u,
    n: games.length,
    p: o + u ? o / (o + u) : 0.5,
  };
}

export function fmtO(o: number): string {
  return o > 0 ? "+" + o : "" + o;
}

export function decOdds(o: number): number {
  return o > 0 ? 1 + o / 100 : 1 + 100 / -o;
}

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function defChip(r: number): string {
  const cls = r >= 21 ? "soft" : r <= 10 ? "tough" : "mid";
  const title =
    "1st = toughest defense (allows fewest), 30th = softest";
  return `<span class="chip ${cls}" title="${title}">${ord(r)}</span>`;
}

export function md(d: string): string {
  return d.slice(5).replace("-", "/");
}

export function restTxt(r: number): string {
  return r === 0
    ? "B2B"
    : r >= 4
      ? "4+ days rest"
      : r + (r === 1 ? " day" : " days") + " rest";
}

export function scheduleSpots(g: SlateGame) {
  const out: { t: string; l: string }[] = [];
  const h = g.home,
    a = g.away;
  if (g.aRest === 0 && g.hRest >= 1)
    out.push({
      t: `Road ${a} on B2B vs rested ${h}`,
      l: "Fade road team ATS / team total Under (2-3 pt decline)",
    });
  if (g.hRest >= 3 && g.aRest <= 2)
    out.push({
      t: `${h} has ${g.hRest}+ days rest vs traveling ${a}`,
      l: "Back rested home team: spread or 1H spread",
    });
  if (g.hRest === 0 && g.aRest === 0)
    out.push({
      t: "Both teams on B2B",
      l: "Game total Under (lower pace, sloppy play)",
    });
  if (g.hFour || g.aFour)
    out.push({
      t: `4 games in 5 nights: ${g.hFour ? h : ""}${g.hFour && g.aFour ? " & " : ""}${g.aFour ? a : ""}`,
      l: "Totals Under, fade tired team, Q4 props",
    });
  if (Math.abs(g.spread) <= 5)
    out.push({
      t: `Projected close game (spread ${g.spread > 0 ? "+" : ""}${g.spread})`,
      l: "Q4 Under / live Under, star points props Over (shortened rotation)",
    });
  return out;
}

export function totalLean(g: SlateGame): [string, string, string] {
  const fast = g.pace >= 100,
    slow = g.pace <= 98.5;
  if ((g.hRest === 0 && g.aRest === 0) || g.hFour || g.aFour)
    return ["UNDER", "bad", "Fatigue compounds: lower pace + shooting"];
  if (g.hRest === 0 || g.aRest === 0) {
    if (slow) return ["UNDER", "bad", "One team on B2B and slow pace"];
    if (fast)
      return [
        "No strong lean",
        "blue",
        "B2B vs fast pace: mixed",
      ];
    return [
      "Slight UNDER",
      "warn",
      "One team on B2B: neutral to slight under",
    ];
  }
  if (fast) return ["OVER", "ok", "Rested teams + fast pace"];
  if (g.hRest >= 3 && g.aRest >= 3)
    return ["Slight OVER", "ok", "Both 3+ days rest"];
  if (slow)
    return ["Slight UNDER", "warn", "Slow, defensive matchup"];
  return [
    "No strong lean",
    "blue",
    "Mixed factors: pass or look at props",
  ];
}