/**
 * Prop analysis: sharp-book consensus (for +EV spotting only), injury impact and the
 * bet rating built from the TopEndSports NBA strategy guide.
 */
import type {
  InjuryImpact,
  InjuryItem,
  Player,
  Prop,
  PropAnalysis,
  PropBook,
  SlateGame,
  TeamData,
} from "@/types";
import { SHARP_BOOK_ALIAS, SHARP_BOOK_WEIGHTS } from "@/types";
import type { AppState } from "./nba";
import { decOdds, normName, ord, posFull, record, windows } from "./nba";

/* ---------- sharp consensus ---------- */
const bookKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Weighted true probability for one side of a prop at one line, from the sharp books only.
 * Each book is de-vigged (its Over and Under are normalized to sum to 100%) and only books
 * quoting exactly `line` count. Weights are renormalized over the books that priced it.
 * Returns prob = null when no sharp book has that line.
 */
export function consensusProb(
  sharp: PropBook[] | undefined,
  side: "over" | "under",
  line: number,
): PropAnalysis["consensus"] {
  const used: PropAnalysis["consensus"]["booksUsed"] = [];
  let total = 0;
  (sharp || []).forEach((b) => {
    if (b.line !== line || b.over == null || b.under == null) return;
    const key = bookKey(b.book);
    const w = SHARP_BOOK_WEIGHTS[key];
    if (!w) return;
    const po = 1 / decOdds(b.over);
    const pu = 1 / decOdds(b.under);
    const prob = (side === "over" ? po : pu) / (po + pu);
    used.push({ name: SHARP_BOOK_ALIAS[key] || b.book, weight: w, prob, odds: b[side], line: b.line });
    total += w;
  });
  if (!used.length) return { prob: null, booksUsed: [] };
  used.forEach((u) => (u.weight = (u.weight / total) * 100));
  return { prob: used.reduce((s, u) => s + (u.prob * u.weight) / 100, 0), booksUsed: used };
}

/* ---------- injuries ---------- */
// how likely the player is to miss the game, from the report status
function missWeight(status: string): number {
  const s = (status || "").toLowerCase();
  if (s.includes("out")) return 1;
  if (s.includes("doubtful")) return 0.8;
  if (s.includes("questionable") || s.includes("day")) return 0.5;
  if (s.includes("probable")) return 0.15;
  return 0.3;
}

// which box-score columns a market depends on
function marketShares(market: string): { pts: number; reb: number; ast: number; min: number } {
  const m = market.replace(/^q\d_/, "");
  const z = { pts: 0, reb: 0, ast: 0, min: 0 };
  switch (m) {
    case "pts": return { ...z, pts: 1 };
    case "reb": return { ...z, reb: 1 };
    case "ast": return { ...z, ast: 1 };
    case "fg3": return { ...z, pts: 0.7, min: 0.3 };
    case "pra": return { ...z, pts: 0.5, reb: 0.25, ast: 0.25 };
    case "pts_ast": return { ...z, pts: 0.6, ast: 0.4 };
    case "pts_reb": return { ...z, pts: 0.6, reb: 0.4 };
    case "reb_ast": return { ...z, reb: 0.5, ast: 0.5 };
    default: return { ...z, min: 1 }; // stl, blk, tov, blk+stl, dd, td: mostly minutes-driven
  }
}

const cap = (x: number, a: number) => Math.max(-a, Math.min(a, x));

/**
 * How the injury report changes this specific prop. Positive shift = more opportunity
 * (favors the Over); negative = favors the Under. Looks past stars: any rotation player
 * (15+ mpg) who is out changes minutes, usage and matchups, scaled by how much of the
 * stat the missing player was producing and whether he plays the same position.
 */
export function injuryImpact(
  state: Pick<AppState, "PLAYERS" | "injuries">,
  pl: Player,
  opp: string,
  market: string,
): InjuryImpact {
  const items: InjuryItem[] = [];
  const sh = marketShares(market);
  const find = (name: string, team: string) =>
    state.PLAYERS.find((p) => p.team === team && normName(p.name) === normName(name));

  // 1. the player's own availability
  let self: InjuryImpact["self"] = "none";
  (state.injuries[pl.team] || []).forEach((i) => {
    if (normName(i.name) !== normName(pl.name)) return;
    const w = missWeight(i.status);
    if (w >= 0.8) {
      self = "out";
      items.push({ name: pl.name, side: "self", status: i.status, shift: 0, detail: `${pl.name} is listed ${i.status}${i.note ? ` (${i.note})` : ""} — likely no action, do not bet` });
    } else if (w >= 0.3) {
      self = "risk";
      items.push({ name: pl.name, side: "self", status: i.status, shift: 0, detail: `${pl.name} is listed ${i.status} — confirm he is active; minutes could also be limited` });
    }
  });

  // 2. teammates who are out: minutes and usage flow to the rest of the rotation
  let teamShift = 0;
  let rotationOut = 0;
  (state.injuries[pl.team] || []).forEach((i) => {
    const ip = find(i.name, pl.team);
    if (!ip || ip.id === pl.id) return;
    const w = missWeight(i.status);
    if (w < 0.3) return;
    const tier = ip.min >= 30 ? 1 : ip.min >= 22 ? 0.6 : 0.3;
    rotationOut += w * tier;
    const opps =
      sh.pts * (Math.min(ip.pts, 28) / 20) +
      sh.reb * (Math.min(ip.reb, 12) / 8) +
      sh.ast * (Math.min(ip.ast, 9) / 6) +
      sh.min * 0.7;
    const samePos = ip.pos === pl.pos;
    const boost = cap(w * tier * opps * 4 + (samePos ? w * tier * 1.5 : 0), 6);
    teamShift += boost;
    const line = `${ip.name} (${ip.min.toFixed(0)} mpg, ${ip.pts.toFixed(1)}p/${ip.reb.toFixed(1)}r/${ip.ast.toFixed(1)}a) ${i.status}`;
    items.push({
      name: ip.name,
      side: "team",
      status: i.status,
      shift: Math.round(boost * 10) / 10,
      detail:
        boost >= 2
          ? `${line} — ${samePos ? "same position, so his minutes and shots go straight to " + pl.name : "usage and minutes shift to " + pl.name} (more ${marketWord(market)} opportunity)`
          : `${line} — small effect on ${marketWord(market)}`,
    });
  });
  teamShift = cap(teamShift, 10);
  if (rotationOut >= 1.5)
    items.push({
      name: "Rotation",
      side: "team",
      status: "",
      shift: 0,
      detail: `${pl.team} is missing several rotation players — expect shortened rotations, lineup volatility and possible pace changes`,
    });

  // 3. opponent absences: weaker defense at the matchup, or no rim protection
  let oppShift = 0;
  (state.injuries[opp] || []).forEach((i) => {
    const ip = find(i.name, opp);
    if (!ip) return;
    const w = missWeight(i.status);
    if (w < 0.3) return;
    const tier = ip.min >= 30 ? 1 : ip.min >= 22 ? 0.6 : 0.3;
    let base = ip.pos === pl.pos ? 2.5 : 1;
    if (ip.pos === "C") base += 1.5 * sh.reb + (pl.pos === "C" ? 1 : 0);
    const boost = cap(w * tier * base * (1 - sh.min * 0.7), 5);
    oppShift += boost;
    items.push({
      name: ip.name,
      side: "opp",
      status: i.status,
      shift: Math.round(boost * 10) / 10,
      detail:
        boost >= 1.5
          ? `${opp}'s ${ip.name} (${ip.min.toFixed(0)} mpg, ${posFull(ip.posRaw)}) ${i.status} — ${ip.pos === "C" ? "no rim protection, helps interior scoring and rebounds" : ip.pos === pl.pos ? "the usual matchup for " + pl.name + " is missing" : "weaker defense overall"}`
          : `${opp}'s ${ip.name} ${i.status} — minor effect on this prop`,
    });
  });
  oppShift = cap(oppShift, 6);

  const shift = Math.round((teamShift + oppShift) * 10) / 10;
  items.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
  return { shift, items, self };
}

function marketWord(market: string): string {
  const m = market.replace(/^q\d_/, "");
  return (
    { pts: "scoring", reb: "rebounding", ast: "playmaking", fg3: "three-point", pra: "all-around", pts_ast: "scoring and passing", pts_reb: "scoring and rebounding", reb_ast: "rebounding and passing" } as Record<string, string>
  )[m] || "minutes-driven";
}

/* ---------- bet rating ---------- */
export type BetRating = PropAnalysis["rating"];

export function calculateBetRating(opts: {
  pl: Player;
  gm: SlateGame | null;
  side: "over" | "under";
  opp: string;
  oppName: string;
  rank: number;
  ev: number;
  noSharp: boolean;
  l10Rate: number | null; // hit rate of the picked side
  seasonRate: number | null;
  injury: InjuryImpact;
  T: Record<string, TeamData>;
}): BetRating {
  const { pl, gm, side, opp, rank, ev, noSharp, l10Rate, seasonRate, injury, T } = opts;
  const dir = side === "under" ? -1 : 1; // factors that help Overs hurt Unders
  const factors: BetRating["factors"] = [];
  let score = 50;
  const add = (delta: number, name: string, detail: string) => {
    const eff = delta * dir;
    score += eff;
    factors.push({ name, impact: eff > 0 ? "positive" : eff < 0 ? "negative" : "neutral", detail });
  };
  const note = (name: string, impact: "positive" | "negative" | "neutral", detail: string) => {
    factors.push({ name, impact, detail });
  };

  // availability always matters, whichever side you take
  if (injury.self === "out") {
    score -= 40;
    note("Availability", "negative", `${pl.name} is listed out`);
  } else if (injury.self === "risk") {
    score -= 8;
    note("Availability", "negative", `${pl.name} is on the injury report — confirm he is active`);
  }

  // 1. Schedule / rest
  if (gm) {
    const home = pl.team === gm.home;
    const rest = home ? gm.hRest : gm.aRest;
    const oppRest = home ? gm.aRest : gm.hRest;
    const four = home ? gm.hFour : gm.aFour;
    if (rest === 0) add(-12, "Schedule", `${pl.team} on a back-to-back — typically a 1-3 point decline, especially for guards`);
    else if (rest >= 3) add(8, "Schedule", `${pl.team} has ${rest} days of rest — fresh legs`);
    else note("Schedule", "neutral", `${rest} day(s) of rest — no real edge`);
    if (four) add(-8, "Schedule", `${pl.team} is playing 4 games in 5 nights — fatigue`);
    if (oppRest === 0 && rest !== 0) add(6, "Schedule", `${opp} is on a back-to-back — tired defense`);
    if (rest === 0 && pl.pos === "G") add(-6, "Fatigue", "Guards cover the most ground and fade first on back-to-backs");
  }

  // 2. Defense vs position
  if (rank <= 10) add(-9, "Defense", `Tough matchup: ${opts.oppName || opp} ranks ${ord(rank)} vs ${posFull(pl.posRaw)}`);
  else if (rank >= 21) add(9, "Defense", `Soft matchup: ${opts.oppName || opp} ranks ${ord(rank)} vs ${posFull(pl.posRaw)}`);
  else note("Defense", "neutral", `Average defense (${ord(rank)}) — no edge`);

  // 3. Sharp +EV (already measured for the picked side)
  if (noSharp) {
    note("Sharp EV", "neutral", "No sharp book priced this exact line, so +EV can't be measured");
  } else if (ev >= 0.08) {
    score += 15;
    note("Sharp EV", "positive", `Strong edge +${(ev * 100).toFixed(1)}% over the sharp consensus`);
  } else if (ev >= 0.03) {
    score += 8;
    note("Sharp EV", "positive", `Edge +${(ev * 100).toFixed(1)}% over the sharp consensus`);
  } else if (ev > 0) {
    score += 2;
    note("Sharp EV", "neutral", `Small edge +${(ev * 100).toFixed(1)}%, below the 3% threshold`);
  } else {
    score -= 10;
    note("Sharp EV", "negative", "No positive EV at any book");
  }

  // 4. Trend of the picked side
  if (l10Rate != null && seasonRate != null) {
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    if (l10Rate > seasonRate + 0.1) {
      score += 5;
      note("Trend", "positive", `Heating up: this side hit ${pct(l10Rate)} in L10 vs ${pct(seasonRate)} on the season`);
    } else if (l10Rate < seasonRate - 0.1) {
      score -= 5;
      note("Trend", "negative", `Cooling off: this side hit ${pct(l10Rate)} in L10 vs ${pct(seasonRate)} on the season`);
    } else note("Trend", "neutral", "Steady: L10 matches the season rate");
  }

  // 5. Injuries: teammates and opponents, scaled by minutes and position
  if (injury.items.length) {
    const eff = injury.shift * dir;
    score += eff;
    injury.items.forEach((it) => {
      const e = it.shift * dir;
      factors.push({ name: "Injuries", impact: it.shift === 0 ? "neutral" : e > 0 ? "positive" : "negative", detail: it.detail });
    });
  } else {
    note("Injuries", "neutral", "No rotation injuries affect this prop");
  }

  // 6. Pace
  const tm = T[pl.team];
  if (gm && tm && tm.pace >= 100) add(3, "Pace", `${pl.team} plays fast (${tm.pace.toFixed(1)} poss) — more possessions`);
  else if (gm && tm && tm.pace <= 98.5) add(-3, "Pace", `${pl.team} plays slow (${tm.pace.toFixed(1)} poss) — fewer possessions`);

  score = Math.max(1, Math.min(100, Math.round(score)));
  const grade: BetRating["grade"] = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
  return { score, grade, factors };
}

/* ---------- full prop analysis ---------- */
export function analyzeProp(state: AppState, p: Prop): PropAnalysis | null {
  const pl = state.PLAYERS[p.pid];
  if (!pl || !p.books.length) return null;
  const gm = state.SLATE[p.gid] || null;
  const opp = p.opp;

  // EV of every retail price against the sharp consensus at that same line
  let best: PropAnalysis["best"] | null = null;
  p.books.forEach((b) => {
    (["over", "under"] as const).forEach((side) => {
      const o = b[side];
      if (o == null) return;
      const c = consensusProb(p.sharp, side, b.line);
      if (c.prob == null) return;
      const ev = c.prob * (decOdds(o) - 1) - (1 - c.prob);
      if (!best || ev > best.ev) best = { book: b.book, side, line: b.line, odds: o, ev, p: c.prob };
    });
  });
  const noSharp = !best;
  if (!best) {
    const b = p.books[0];
    best = { book: b.book, side: "over", line: b.line, odds: b.over, ev: 0, p: 1 / decOdds(b.over) };
  }
  const pick = best as PropAnalysis["best"];
  const consensus = consensusProb(p.sharp, pick.side, pick.line);

  const rank = state.T[opp]?.rank[pl.pos]?.[p.market] || 15;
  const conf: PropAnalysis["conf"] = pick.ev >= 0.08 ? "Strong" : pick.ev >= 0.03 ? "Lean" : "Pass";
  const injury = injuryImpact(state, pl, opp, p.market);

  const w = windows(pl, state.seasonStart);
  const r10 = record(w.l10, p.market, pick.line);
  const rc = record(w.cur, p.market, pick.line);
  const sideRate = (r: { o: number; u: number; pct: number | null }) =>
    r.pct == null ? null : pick.side === "over" ? r.pct : 1 - r.pct;

  const rating = calculateBetRating({
    pl,
    gm,
    side: pick.side,
    opp,
    oppName: state.T[opp]?.name || opp,
    rank,
    ev: pick.ev,
    noSharp,
    l10Rate: sideRate(r10),
    seasonRate: sideRate(rc),
    injury,
    T: state.T,
  });
  return { rank, best: pick, conf, noSharp, consensus, injury, rating };
}

export type SideHit = { hit: number; n: number; pct: number | null };

/** How often the picked side (Over or Under at the pick's line) has hit over each window. */
export function sideHits(
  pl: Player,
  state: Pick<AppState, "seasonStart">,
  p: Prop,
  a: PropAnalysis,
): Record<"l5" | "l10" | "l15" | "szn" | "h2h", SideHit> {
  const { side, line } = a.best;
  const w = windows(pl, state.seasonStart);
  const mk = (games: any[]): SideHit => {
    const known = games.filter((g) => Number.isFinite(g[p.market]));
    const r = record(known, p.market, line);
    const hit = side === "over" ? r.o : r.u;
    return { hit, n: r.n, pct: r.n ? hit / r.n : null };
  };
  return {
    l5: mk(pl.log.slice(0, 5)),
    l10: mk(w.l10),
    l15: mk(w.l15),
    szn: mk(w.cur),
    h2h: mk(pl.log.filter((g) => g.opp === p.opp)),
  };
}

/** Compute and attach the analysis for every prop (call after processData). */
export function annotateProps(state: AppState): void {
  state.PROPS.forEach((p) => {
    p._analysis = analyzeProp(state, p) || undefined;
  });
}

/* ---------- grading ---------- */
/** Grade a pick against the player's box score for that date; null if the game isn't in the data yet. */
export function gradeAgainstLog(
  pl: Player | undefined,
  date: string,
  market: string,
  line: number,
  side: "over" | "under",
): { result: "win" | "loss" | "push"; actual: number } | null {
  if (!pl) return null;
  const g = pl.log.find((x) => x.date === date);
  const v = g ? (g as any)[market] : undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v === line) return { result: "push", actual: v };
  const over = v > line;
  return { result: (side === "over") === over ? "win" : "loss", actual: v };
}
