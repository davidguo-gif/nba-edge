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

// The report's estimated return date ("Nov 12") is before the game, so he has probably already come back
function returnedBy(ret: string, gameDate: string): boolean {
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/.exec((ret || "").trim());
  if (!m) return false;
  const mon = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].toLowerCase());
  if (mon < 0) return false;
  const iso = `${gameDate.slice(0, 4)}-${String(mon + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return iso < gameDate && Date.parse(gameDate) - Date.parse(iso) < 120 * 864e5;
}

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
  gameDate: string,
): InjuryImpact {
  const items: InjuryItem[] = [];
  const sh = marketShares(market);
  // A player who has been out for weeks is already baked into everyone's recent stats, so count him less
  const staleness = (ip: Player) => {
    const last = ip.log[0]?.date;
    const away = last ? (Date.parse(gameDate + "T00:00:00Z") - Date.parse(last + "T00:00:00Z")) / 864e5 : 99;
    return away >= 21 ? 0.25 : away >= 10 ? 0.6 : 1;
  };
  const find = (name: string, team: string) =>
    state.PLAYERS.find((p) => p.team === team && normName(p.name) === normName(name));

  // 1. the player's own availability
  let self: InjuryImpact["self"] = "none";
  (state.injuries[pl.team] || []).forEach((i) => {
    if (normName(i.name) !== normName(pl.name)) return;
    const w = missWeight(i.status) * (returnedBy(i.return, gameDate) ? 0.35 : 1);
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
    const st = staleness(ip);
    const w = missWeight(i.status) * st * (returnedBy(i.return, gameDate) ? 0.35 : 1);
    if (w < 0.15) return;
    const tier = ip.min >= 30 ? 1 : ip.min >= 22 ? 0.6 : 0.3;
    if (st === 1) rotationOut += w * tier;
    const opps =
      sh.pts * (Math.min(ip.pts, 28) / 20) +
      sh.reb * (Math.min(ip.reb, 12) / 8) +
      sh.ast * (Math.min(ip.ast, 9) / 6) +
      sh.min * 0.7;
    const samePos = ip.pos === pl.pos;
    const boost = cap(w * tier * opps * 4 + (samePos ? w * tier * 1.5 : 0), 6);
    teamShift += boost;
    const line = `${ip.name} (${ip.min.toFixed(0)} mpg, ${ip.pts.toFixed(1)}p/${ip.reb.toFixed(1)}r/${ip.ast.toFixed(1)}a) ${i.status}${st < 1 ? ", out for a while so already in recent stats" : ""}`;
    if (boost < 1) return; // too small to matter for this prop
    items.push({
      name: ip.name,
      side: "team",
      status: i.status,
      shift: Math.round(boost * 10) / 10,
      detail: `${line} — ${samePos ? "same position, so his minutes and shots go straight to " + pl.name : "usage and minutes shift to " + pl.name} (more ${marketWord(market)} opportunity)`,
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
    const w = missWeight(i.status) * staleness(ip) * (returnedBy(i.return, gameDate) ? 0.35 : 1);
    if (w < 0.15) return;
    const tier = ip.min >= 30 ? 1 : ip.min >= 22 ? 0.6 : 0.3;
    let base = ip.pos === pl.pos ? 2.5 : 1;
    if (ip.pos === "C") base += 1.5 * sh.reb + (pl.pos === "C" ? 1 : 0);
    const boost = cap(w * tier * base * (1 - sh.min * 0.7), 5);
    if (boost < 1) return; // too small to matter for this prop
    oppShift += boost;
    items.push({
      name: ip.name,
      side: "opp",
      status: i.status,
      shift: Math.round(boost * 10) / 10,
      detail: `${opp}'s ${ip.name} (${ip.min.toFixed(0)} mpg, ${posFull(ip.posRaw)}) ${i.status} — ${ip.pos === "C" ? "no rim protection, helps interior scoring and rebounds" : ip.pos === pl.pos ? "the usual matchup for " + pl.name + " is missing" : "weaker defense overall"}`,
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
  let lean = 0; // net situational push toward the Over (negative = Under), independent of the side picked
  const add = (delta: number, name: string, detail: string) => {
    const eff = delta * dir;
    score += eff;
    lean += delta;
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
  const src = noSharp ? "our model" : "sharp books and our model";
  if (ev >= 0.08) {
    score += 15;
    note("Projected EV", "positive", `Strong edge +${(ev * 100).toFixed(1)}% (${src})`);
  } else if (ev >= 0.03) {
    score += 8;
    note("Projected EV", "positive", `Edge +${(ev * 100).toFixed(1)}% (${src})`);
  } else if (ev > 0) {
    score += 2;
    note("Projected EV", "neutral", `Small edge +${(ev * 100).toFixed(1)}%, below the 3% threshold`);
  } else if (ev < 0) {
    score -= 10;
    note("Projected EV", "negative", "No positive EV at any book");
  } else {
    note("Projected EV", "neutral", "Not enough data to project EV");
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
    lean += injury.shift;
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
  return { score, grade, factors, lean };
}

/* ---------- probability model ---------- */
function poissonCdf(k: number, lambda: number): number {
  if (k < 0) return 0;
  let term = Math.exp(-lambda);
  let sum = term;
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
    sum += term;
  }
  return Math.min(1, sum);
}
const erf = (x: number) => {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-a * a);
  return s * y;
};
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/** P(stat > line) and P(stat < line) for a stat with this mean: Poisson for small counts, normal otherwise. */
function overUnder(mean: number, line: number, sigma: number): { over: number; under: number } {
  if (mean < 5) {
    const lam = Math.max(0.05, mean);
    return { over: 1 - poissonCdf(Math.floor(line), lam), under: poissonCdf(Math.ceil(line) - 1, lam) };
  }
  return { over: 1 - Phi((Math.floor(line) + 0.5 - mean) / sigma), under: Phi((Math.ceil(line) - 0.5 - mean) / sigma) };
}
function sideProb(side: "over" | "under", mean: number, line: number, sigma: number): number {
  const { over, under } = overUnder(mean, line, sigma);
  return (side === "over" ? over : under) / Math.max(1e-9, over + under); // pushes are refunded, so drop them
}

type Profile = { szn: number; l10: number; sigma: number };
/** Season average, last-10 average and game-to-game spread for a stat, from the game log. */
function statProfile(pl: Player, seasonStart: string, market: string): Profile | null {
  if (/^q\d_/.test(market) || market === "dd" || market === "td") return null;
  const val = (g: any) => g[market] as number;
  const cur = pl.log.filter((g) => g.date >= seasonStart).map(val).filter(Number.isFinite);
  const pool = cur.length >= 8 ? cur : pl.log.slice(0, 20).map(val).filter(Number.isFinite);
  if (pool.length < 5) return null;
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const mean = avg(pool);
  const sd = Math.sqrt(avg(pool.map((x) => (x - mean) ** 2)));
  const l10 = pl.log.slice(0, 10).map(val).filter(Number.isFinite);
  return { szn: mean, l10: l10.length ? avg(l10) : mean, sigma: Math.max(sd, 0.6, mean * 0.2) };
}

/**
 * What the market itself projects (the "external" projection): for each book, the stat average that
 * makes its de-vigged Over/Under prices fair at its line. Sharp books are used when they priced the
 * prop, otherwise the retail books.
 */
function marketMean(p: Prop, prof: Profile | null): { mean: number | null; source: "sharp" | "retail" | null } {
  if (!prof) return { mean: null, source: null };
  const solve = (b: PropBook) => {
    const po = 1 / decOdds(b.over);
    const pu = 1 / decOdds(b.under);
    const target = po / (po + pu);
    let lo = 0;
    let hi = Math.max(10, b.line * 3 + 10);
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const { over, under } = overUnder(mid, b.line, prof.sigma);
      if (over / Math.max(1e-9, over + under) < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const pool = (books: PropBook[], weight: (b: PropBook) => number) => {
    const ok = books.filter((b) => b.over != null && b.under != null);
    const tw = ok.reduce((s, b) => s + weight(b), 0);
    return ok.length && tw > 0 ? ok.reduce((s, b) => s + solve(b) * weight(b), 0) / tw : null;
  };
  const sharp = pool(p.sharp || [], (b) => SHARP_BOOK_WEIGHTS[bookKey(b.book)] || 0);
  if (sharp != null) return { mean: sharp, source: "sharp" };
  const retail = pool(p.books, () => 1);
  return retail != null ? { mean: retail, source: "retail" } : { mean: null, source: null };
}

/* ---------- full prop analysis ---------- */
export function analyzeProp(state: AppState, p: Prop): PropAnalysis | null {
  const pl = state.PLAYERS[p.pid];
  if (!pl || !p.books.length) return null;
  const gm = state.SLATE[p.gid] || null;
  const opp = p.opp;

  const rank = state.T[opp]?.rank[pl.pos]?.[p.market] || 15;
  const injury = injuryImpact(state, pl, opp, p.market, p.date);
  const baseRating = {
    pl,
    gm,
    opp,
    oppName: state.T[opp]?.name || opp,
    rank,
    injury,
    T: state.T,
  };

  // 1. Our model's net situational push (rest, defense, pace, injuries) in rating points
  const lean = calculateBetRating({ ...baseRating, side: "over", ev: 0, noSharp: true, l10Rate: null, seasonRate: null }).lean;

  // 2. External projection: what the market implies, then adjusted by our model
  const prof = statProfile(pl, state.seasonStart, p.market);
  const mk = marketMean(p, prof);
  const adj = prof ? prof.sigma * 0.01 * lean : 0;
  const base = prof ? (prof.szn + prof.l10) / 2 + adj : null;
  const proj = mk.mean != null ? mk.mean + adj : base;
  const modelMean = prof && proj != null ? 0.65 * proj + 0.35 * (base as number) : null;

  // 3. Projected win rate and EV at every retail price (sharp consensus blended with our model)
  let best: PropAnalysis["best"] | null = null;
  p.books.forEach((b) => {
    (["over", "under"] as const).forEach((side) => {
      const o = b[side];
      if (o == null) return;
      const pSharp = consensusProb(p.sharp, side, b.line).prob;
      const pModel = prof && modelMean != null ? sideProb(side, modelMean, b.line, prof.sigma) : null;
      let prob: number | null = null;
      if (pSharp != null && pModel != null) prob = 0.5 * pSharp + 0.5 * pModel;
      else if (pSharp != null) prob = pSharp;
      else if (pModel != null) prob = 0.5 + 0.75 * (pModel - 0.5); // model alone: shrink toward 50% since nothing confirms it
      if (prob == null) return;
      prob = Math.max(0.03, Math.min(0.97, prob));
      const ev = prob * (decOdds(o) - 1) - (1 - prob);
      if (!best || ev > best.ev)
        best = { book: b.book, side, line: b.line, odds: o, ev, p: prob, link: side === "over" ? b.overLink : b.underLink, pModel, pSharp };
    });
  });
  const source: PropAnalysis["source"] = !best
    ? "none"
    : best.pSharp != null && best.pModel != null
      ? "sharp+model"
      : best.pSharp != null
        ? "sharp"
        : "model";
  const noSharp = source === "none" || source === "model";
  if (!best) {
    const b = p.books[0];
    best = { book: b.book, side: "over", line: b.line, odds: b.over, ev: 0, p: 1 / decOdds(b.over), link: b.overLink };
  }
  const pick = best as PropAnalysis["best"];
  const consensus = consensusProb(p.sharp, pick.side, pick.line);
  const conf: PropAnalysis["conf"] = source === "none" ? "Pass" : pick.ev >= 0.08 ? "Strong" : pick.ev >= 0.03 ? "Lean" : "Pass";

  const w = windows(pl, state.seasonStart);
  const r10 = record(w.l10, p.market, pick.line);
  const rc = record(w.cur, p.market, pick.line);
  const sideRate = (r: { o: number; u: number; pct: number | null }) =>
    r.pct == null ? null : pick.side === "over" ? r.pct : 1 - r.pct;

  const rating = calculateBetRating({
    ...baseRating,
    side: pick.side,
    ev: source === "none" ? 0 : pick.ev,
    noSharp,
    l10Rate: sideRate(r10),
    seasonRate: sideRate(rc),
  });
  return {
    rank,
    best: pick,
    conf,
    noSharp,
    source,
    proj: proj != null ? Math.round(proj * 10) / 10 : null,
    mkt: mk.mean != null ? Math.round(mk.mean * 10) / 10 : null,
    mktSource: mk.source,
    adj: Math.round(adj * 10) / 10,
    consensus,
    injury,
    rating,
  };
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
