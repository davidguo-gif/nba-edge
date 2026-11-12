/**
 * Parlay rules, from "NBA Betting Strategy and Systems" (topendsports.com):
 *  - keep parlays to 2-4 legs
 *  - avoid -300 or heavier favorites as a leg
 *  - use correlation: legs should be linked outcomes in the SAME game
 *    (e.g. rested team's spread + Under when the opponent is on a back-to-back)
 *  - don't force parlays: no schedule edge, no parlay
 *  - never risk more than 3% of bankroll on one game (most bets 1-2%)
 */
import type { ParlayLeg, PropBook, SlateGame, Player, Prop } from "@/types";
import { decOdds, mktWord, totalLean } from "./nba";

export const MIN_LEGS = 2;
export const MAX_LEGS = 4;
export const HEAVY_FAV = -300;
export const MAX_STAKE_PCT = 3;
export const DEFAULT_ODDS = -110;

export const combinedDecimal = (legs: ParlayLeg[]) =>
  legs.reduce((a, l) => a * decOdds(l.odds), 1);

export const toAmerican = (dec: number) =>
  dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));

const opp = (g: SlateGame, t: string) => (g.home === t ? g.away : g.home);

/** Teams that are in a fatigue / travel disadvantage spot tonight. */
export function tiredTeams(g: SlateGame): string[] {
  const out: string[] = [];
  if (g.hRest === 0 || g.hFour) out.push(g.home);
  if (g.aRest === 0 || g.aFour || (g.hRest >= 3 && g.aRest <= 2)) out.push(g.away);
  return out;
}

export const hasSchedulePlay = (g: SlateGame) => tiredTeams(g).length > 0;

export function whyTired(g: SlateGame, team: string): string {
  const home = team === g.home;
  const rest = home ? g.hRest : g.aRest;
  const four = home ? g.hFour : g.aFour;
  if (rest === 0) return `${team} is on the second night of a back-to-back`;
  if (four) return `${team} is playing its 4th game in 5 nights`;
  return `${team} is traveling against a well-rested opponent`;
}

/* ---------- building legs ---------- */
export const gameName = (g: SlateGame) => `${g.away} @ ${g.home}`;

export function spreadLeg(g: SlateGame, team: string): ParlayLeg {
  return {
    id: `sp-${g.id}-${team}`,
    gameId: g.id,
    game: gameName(g),
    kind: "spread",
    side: "cover",
    team,
    label: `${team} to cover the spread`,
    odds: DEFAULT_ODDS,
  };
}

export function totalLeg(g: SlateGame, side: "over" | "under"): ParlayLeg {
  return {
    id: `tot-${g.id}-${side}`,
    gameId: g.id,
    game: gameName(g),
    kind: "total",
    side,
    label: `Game total ${side === "over" ? "Over" : "Under"} (our projection: ${g.total})`,
    odds: DEFAULT_ODDS,
  };
}

export function teamTotalLeg(g: SlateGame, team: string, side: "over" | "under"): ParlayLeg {
  return {
    id: `tt-${g.id}-${team}-${side}`,
    gameId: g.id,
    game: gameName(g),
    kind: "teamtotal",
    side,
    team,
    label: `${team} team total ${side === "over" ? "Over" : "Under"}`,
    odds: DEFAULT_ODDS,
  };
}

export function bestPrice(books: PropBook[], side: "over" | "under") {
  let best = { book: books[0].book, line: books[0].line, price: books[0][side] };
  books.forEach((b) => {
    if (decOdds(b[side]) > decOdds(best.price)) best = { book: b.book, line: b.line, price: b[side] };
  });
  return best;
}

export function propLeg(p: Prop, pl: Player, g: SlateGame | null, side: "over" | "under"): ParlayLeg {
  const b = bestPrice(p.books, side);
  return {
    id: `pr-${p.id}-${side}`,
    gameId: g ? g.id : null,
    game: g ? gameName(g) : pl.team,
    kind: "prop",
    side,
    team: pl.team,
    player: pl.name,
    pos: pl.pos,
    market: p.market,
    line: b.line,
    label: `${pl.name} ${side === "over" ? "Over" : "Under"} ${b.line} ${mktWord(p.market)}`,
    odds: b.price,
    book: b.book,
  };
}

/* ---------- correlation ---------- */
const OVERISH = ["pts", "ast", "fg3", "pra"];

/** Why two legs move together (null = not linked). */
export function linkReason(a: ParlayLeg, b: ParlayLeg, games: SlateGame[]): string | null {
  if (a.gameId == null || a.gameId !== b.gameId) return null;
  const g = games.find((x) => x.id === a.gameId);
  if (!g) return null;
  const pair = (k1: ParlayLeg["kind"], k2: ParlayLeg["kind"]): [ParlayLeg, ParlayLeg] | null =>
    a.kind === k1 && b.kind === k2 ? [a, b] : b.kind === k1 && a.kind === k2 ? [b, a] : null;

  let m: [ParlayLeg, ParlayLeg] | null;

  if ((m = pair("spread", "total")) && m[1].side === "under") {
    const tired = tiredTeams(g);
    if (tired.includes(opp(g, m[0].team!)))
      return `${opp(g, m[0].team!)} is tired, so backing ${m[0].team} and the Under go together (slower, sloppier game)`;
    return null;
  }
  if ((m = pair("spread", "teamtotal")) && m[1].side === "under" && m[1].team === opp(g, m[0].team!))
    return `If ${m[0].team} covers, ${m[1].team} is usually held down, so its team total Under goes with it`;
  if ((m = pair("spread", "prop")) && m[1].side === "under" && m[1].team === opp(g, m[0].team!))
    return `If ${m[0].team} covers, ${m[1].team} players tend to score and produce less`;
  if ((m = pair("total", "prop"))) {
    if (m[0].side === "under" && m[1].side === "under")
      return "A low-scoring game means fewer points and assists for players";
    if (m[0].side === "over" && m[1].side === "over" && OVERISH.includes(m[1].market || ""))
      return "A high-scoring game means more shots and stats for players";
  }
  if ((m = pair("total", "teamtotal")) && m[0].side === m[1].side)
    return `A game total ${m[0].side === "under" ? "Under" : "Over"} and a team total ${m[0].side === "under" ? "Under" : "Over"} come from the same low or high scoring`;
  if ((m = pair("teamtotal", "prop")) && m[0].side === "under" && m[1].side === "under" && m[1].team === m[0].team)
    return `If ${m[0].team} scores less, its players produce less`;
  return null;
}

/** Legs that fight each other (can both rarely win). */
export function conflictReason(a: ParlayLeg, b: ParlayLeg): string | null {
  if (a.gameId == null || a.gameId !== b.gameId) return null;
  if (a.kind === "total" && b.kind === "total" && a.side !== b.side) return "Over and Under on the same game total";
  if (a.kind === "spread" && b.kind === "spread" && a.team !== b.team) return "Both teams to cover the same game";
  const t = a.kind === "total" ? a : b.kind === "total" ? b : null;
  const p = a.kind === "prop" ? a : b.kind === "prop" ? b : null;
  if (t && p && t.side !== p.side && OVERISH.includes(p.market || ""))
    return `Game total ${t.side} conflicts with ${p.player} ${p.side}`;
  return null;
}

/* ---------- rule check ---------- */
export interface RuleCheck {
  level: "ok" | "warn" | "bad";
  text: string;
}

export function checkParlay(
  legs: ParlayLeg[],
  games: SlateGame[],
  stakePct: number,
): { checks: RuleCheck[]; ok: boolean } {
  const checks: RuleCheck[] = [];

  if (legs.length < MIN_LEGS)
    checks.push({ level: "warn", text: `Add at least ${MIN_LEGS} legs (a single bet isn't a parlay).` });
  else if (legs.length > MAX_LEGS)
    checks.push({ level: "bad", text: `${legs.length} legs is too many. Keep it to ${MIN_LEGS}-${MAX_LEGS}; variance explodes beyond that.` });
  else checks.push({ level: "ok", text: `${legs.length} legs (the guide says keep it to ${MIN_LEGS}-${MAX_LEGS}).` });

  const heavy = legs.filter((l) => l.odds <= HEAVY_FAV);
  if (heavy.length)
    checks.push({ level: "bad", text: `Heavy favorite leg (${HEAVY_FAV} or worse): ${heavy.map((l) => l.label).join(", ")}. Poor parlay value.` });
  else if (legs.length) checks.push({ level: "ok", text: `No heavy favorites (nothing at ${HEAVY_FAV} or worse).` });

  if (legs.length >= 2) {
    const conflicts: string[] = [];
    const reasons: string[] = [];
    const linked = new Set<string>();
    for (let i = 0; i < legs.length; i++)
      for (let j = i + 1; j < legs.length; j++) {
        const c = conflictReason(legs[i], legs[j]);
        if (c) conflicts.push(c);
        const r = linkReason(legs[i], legs[j], games);
        if (r) {
          reasons.push(r);
          linked.add(legs[i].id);
          linked.add(legs[j].id);
        }
      }
    if (conflicts.length) checks.push({ level: "bad", text: `Conflicting legs: ${conflicts.join("; ")}.` });
    const lone = legs.filter((l) => !linked.has(l.id));
    if (!lone.length) checks.push({ level: "ok", text: `Correlated: ${[...new Set(reasons)].join(". ")}.` });
    else
      checks.push({
        level: "bad",
        text: `Not correlated: ${lone.map((l) => l.label).join(", ")}. Parlaying unrelated bets is the random parlay the guide warns against. Use legs from the same game that depend on each other.`,
      });
  }

  if (stakePct > MAX_STAKE_PCT)
    checks.push({ level: "bad", text: `Stake is ${stakePct.toFixed(1)}% of bankroll. Never risk more than ${MAX_STAKE_PCT}% on one game.` });
  else if (stakePct > 2)
    checks.push({ level: "warn", text: `Stake is ${stakePct.toFixed(1)}% of bankroll. Most bets should be 1-2%.` });
  else if (stakePct > 0) checks.push({ level: "ok", text: `Stake is ${stakePct.toFixed(1)}% of bankroll (within 1-2%).` });

  return { checks, ok: checks.every((c) => c.level !== "bad") && legs.length >= MIN_LEGS };
}

/* ---------- suggestions ---------- */
export interface Suggestion {
  game: SlateGame;
  title: string;
  why: string[];
  legs: ParlayLeg[]; // core legs
  extras: ParlayLeg[]; // optional player-prop add-ons (need odds loaded)
  needsProps: boolean;
}

export function suggestParlays(
  slate: SlateGame[],
  props: Prop[],
  players: Player[],
): Suggestion[] {
  const out: Suggestion[] = [];
  const teamProps = (team: string, side: "over" | "under", markets: string[], guardsOnly: boolean, n: number) =>
    props
      .map((p) => ({ p, pl: players[p.pid] }))
      .filter(
        ({ p, pl }) =>
          pl && pl.team === team && markets.includes(p.market) && (!guardsOnly || pl.pos === "G"),
      )
      .sort((a, b) => b.pl.pts - a.pl.pts)
      .slice(0, n)
      .map(({ p, pl }) => propLeg(p, pl, slate.find((g) => g.home === team || g.away === team) || null, side));

  slate.forEach((g) => {
    const tired = tiredTeams(g);
    const why: string[] = [];

    if (tired.length === 2) {
      // both teams in a fatigue spot
      tired.forEach((t) => why.push(whyTired(g, t)));
      const extras = [
        ...teamProps(g.home, "under", ["pts", "ast"], true, 1),
        ...teamProps(g.away, "under", ["pts", "ast"], true, 1),
      ];
      out.push({
        game: g,
        title: `${gameName(g)}: tired legs on both sides`,
        why: [...why, "Both tired: lower pace and sloppy play, so the total and guard scoring/assist props lean Under (guards cover the most ground and fade first)."],
        legs: [totalLeg(g, "under")],
        extras,
        needsProps: extras.length === 0,
      });
      return;
    }

    if (tired.length === 1) {
      const x = tired[0];
      const y = opp(g, x);
      why.push(whyTired(g, x));
      why.push(`The guide's lean: back ${y} (the fresher team) and the Under; ${x}'s own scoring tends to drop.`);
      const extras = teamProps(x, "under", ["pts", "ast"], true, 2);
      out.push({
        game: g,
        title: `${gameName(g)}: back ${y}, fade ${x}`,
        why,
        legs: [spreadLeg(g, y), totalLeg(g, "under")],
        extras: [teamTotalLeg(g, x, "under"), ...extras],
        needsProps: false,
      });
      return;
    }

    // no fatigue spot: only a parlay if both teams are rested AND fast (clear Over lean)
    const tl = totalLean(g);
    if (tl[0] === "OVER") {
      const extras = [
        ...teamProps(g.home, "over", ["pts"], false, 1),
        ...teamProps(g.away, "over", ["pts"], false, 1),
      ];
      out.push({
        game: g,
        title: `${gameName(g)}: fast pace, both teams rested`,
        why: [tl[2], "Player points Overs go with a high-scoring game."],
        legs: [totalLeg(g, "over")],
        extras,
        needsProps: extras.length === 0,
      });
    }
  });
  return out;
}
