"use client";

import { useMemo, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { fmtO } from "@/lib/nba";
import {
  MAX_LEGS,
  MIN_LEGS,
  HEAVY_FAV,
  MAX_STAKE_PCT,
  checkParlay,
  combinedDecimal,
  toAmerican,
  suggestParlays,
  spreadLeg,
  totalLeg,
  teamTotalLeg,
  gameName,
  hasSchedulePlay,
  tiredTeams,
  whyTired,
} from "@/lib/parlay";
import type { ParlayLeg } from "@/types";

const LEVEL_COLOR: Record<string, string> = { ok: "var(--green, #4ade80)", warn: "#fcd34d", bad: "var(--red, #f87171)" };
const LEVEL_MARK: Record<string, string> = { ok: "\u2713", warn: "!", bad: "\u2717" };

export function ParlayTab() {
  const { state, parlay, addLeg, setLegs, updateLegOdds, removeLeg, bankroll, unitPct, addBet, setActiveTab } =
    useNBA();
  const { SLATE, PROPS, PLAYERS } = state;
  const [units, setUnits] = useState(1);
  const [gameSel, setGameSel] = useState(0);
  const [msg, setMsg] = useState("");

  const suggestions = useMemo(() => suggestParlays(SLATE, PROPS, PLAYERS), [SLATE, PROPS, PLAYERS]);

  const stakePct = units * unitPct;
  const stake$ = (bankroll * stakePct) / 100;
  const dec = combinedDecimal(parlay);
  const { checks, ok } = checkParlay(parlay, SLATE, stakePct);
  const g = SLATE[gameSel];
  const tired = g ? tiredTeams(g) : [];

  const loadSuggestion = (legs: ParlayLeg[]) => {
    setLegs(legs.map((l) => ({ ...l })));
    setMsg("");
  };

  const saveToTracker = () => {
    if (parlay.length < MIN_LEGS) return;
    const desc = `${parlay.length}-leg parlay: ${parlay.map((l) => `${l.label} [${l.game}]`).join(" + ")}`;
    addBet(desc, "Parlay", toAmerican(dec), units);
    setMsg("Saved to Bet Tracker.");
  };

  return (
    <div>
      <h2>Parlay Builder</h2>
      <p className="sub">
        Builds parlays by the rules from the NBA Betting Strategy guide: only linked bets from the same game, 2-4
        legs, no heavy favorites, and no parlay when there is no schedule edge.
      </p>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>The rules</h3>
        <ul className="clean text-sm">
          <li>
            <b>2-{MAX_LEGS} legs only.</b> More than that and the chance of winning collapses.
          </li>
          <li>
            <b>No heavy favorites.</b> Skip any leg at {HEAVY_FAV} or worse; it adds little payout for real risk.
          </li>
          <li>
            <b>Use correlation.</b> Legs should depend on each other, in the same game. Example: when the Lakers are
            on a back-to-back, Celtics spread + game Under work together because a tired team means a slower, lower
            scoring game.
          </li>
          <li>
            <b>Don&apos;t force parlays.</b> No tired team or rest edge tonight? Then no parlay.
          </li>
          <li>
            <b>Keep the stake small.</b> No more than {MAX_STAKE_PCT}% of your bankroll on one game; most bets 1-2%.
          </li>
        </ul>
      </div>

      <h3>Suggested parlays for tonight</h3>
      {SLATE.length === 0 ? (
        <p className="note">No games on the slate yet, so there is nothing to build from.</p>
      ) : suggestions.length === 0 ? (
        <div className="card">
          <b>No correlated spots tonight.</b>
          <div className="text-sm" style={{ color: "var(--mut)", marginTop: 4 }}>
            None of tonight&apos;s games has a back-to-back, 4-games-in-5-nights, or rest edge, and none is a clear
            fast-paced Over. The guide says not to force a parlay. Single bets or props are the better use of
            your bankroll tonight.
          </div>
        </div>
      ) : (
        <div className="grid g2">
          {suggestions.map((s, i) => (
            <div key={i} className="card">
              <div style={{ marginBottom: 4 }}>
                <b>{s.title}</b>
              </div>
              <ul className="clean text-xs" style={{ color: "var(--mut)", marginBottom: 6 }}>
                {s.why.map((w, wi) => (
                  <li key={wi}>{w}</li>
                ))}
              </ul>
              <div className="text-xs" style={{ marginBottom: 2 }}>
                <b>Core legs:</b>
              </div>
              {s.legs.map((l) => (
                <div key={l.id} className="text-sm">
                  {"\u2022"} {l.label}
                </div>
              ))}
              {s.extras.length > 0 && (
                <>
                  <div className="text-xs" style={{ margin: "6px 0 2px" }}>
                    <b>Optional add-ons (linked to the core legs):</b>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {s.extras.map((l) => (
                      <button key={l.id} className="b sm alt" onClick={() => addLeg(l)}>
                        + {l.label} ({fmtO(l.odds)})
                      </button>
                    ))}
                  </div>
                </>
              )}
              {s.needsProps && (
                <div className="text-xs" style={{ color: "var(--mut)", marginTop: 6 }}>
                  Fetch live odds on the Props tab to see linked player props you can add to this parlay.
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <button className="b sm" onClick={() => loadSuggestion(s.legs)}>
                  Load into builder
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 16 }}>Your parlay</h3>
      <div className="card">
        {parlay.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--mut)" }}>
            No legs yet. Load a suggestion above, add a game bet below, or use &ldquo;+ Parlay&rdquo; on a prop in the{" "}
            <a onClick={() => setActiveTab("props")} style={{ cursor: "pointer" }}>
              Props tab
            </a>
            .
          </div>
        ) : (
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Leg</th>
                <th style={{ textAlign: "left" }}>Game</th>
                <th>Odds (American)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {parlay.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.label}
                    {l.book ? <span className="note"> ({l.book})</span> : null}
                  </td>
                  <td>{l.game}</td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="number"
                      value={l.odds}
                      style={{ width: 80 }}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v)) updateLegOdds(l.id, v);
                      }}
                    />
                  </td>
                  <td>
                    <button className="b sm alt" onClick={() => removeLeg(l.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="form" style={{ marginTop: 10 }}>
          <label>
            Stake (units; 1 unit = {unitPct}% of bankroll)
            <input type="number" min={0} step={0.5} value={units} onChange={(e) => setUnits(+e.target.value)} />
          </label>
          <button className="b alt sm" onClick={() => setLegs([])} disabled={!parlay.length}>
            Clear all
          </button>
        </div>

        {parlay.length >= 1 && (
          <div className="text-sm" style={{ marginTop: 8 }}>
            Combined odds: <b>{fmtO(toAmerican(dec))}</b> ({dec.toFixed(2)}x). Stake ${stake$.toFixed(2)} (
            {stakePct.toFixed(1)}% of ${bankroll}) pays <b>${(stake$ * (dec - 1)).toFixed(2)}</b> profit
            (${(stake$ * dec).toFixed(2)} back). The odds imply a {(100 / dec).toFixed(1)}% chance of winning.
          </div>
        )}

        {parlay.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="text-sm" style={{ marginBottom: 4 }}>
              <b>Rule check: </b>
              <span style={{ color: ok ? LEVEL_COLOR.ok : LEVEL_COLOR.bad }}>
                {ok ? "This parlay follows the guide's rules." : "This parlay breaks the guide's rules."}
              </span>
            </div>
            {checks.map((c, i) => (
              <div key={i} className="text-xs" style={{ color: LEVEL_COLOR[c.level], marginBottom: 2 }}>
                {LEVEL_MARK[c.level]} {c.text}
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <button className="b" onClick={saveToTracker} disabled={parlay.length < MIN_LEGS}>
                Save to Bet Tracker
              </button>
              {msg && <span className="note"> {msg}</span>}
            </div>
          </div>
        )}
      </div>

      {SLATE.length > 0 && g && (
        <>
          <h3 style={{ marginTop: 16 }}>Add a game bet</h3>
          <div className="card">
            <div className="form">
              <label>
                Game
                <select value={gameSel} onChange={(e) => setGameSel(+e.target.value)}>
                  {SLATE.map((x, i) => (
                    <option key={i} value={i}>
                      {gameName(x)}
                      {hasSchedulePlay(x) ? " (schedule edge)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="text-xs" style={{ color: "var(--mut)", margin: "6px 0" }}>
              {tired.length
                ? tired.map((t) => whyTired(g, t)).join(". ") + "."
                : "No fatigue or rest edge in this game, so legs here may not be correlated."}{" "}
              Our projection: {g.spread === 0 ? "toss-up" : `${g.spread < 0 ? g.home : g.away} by ${Math.abs(g.spread)}`},{" "}
              {g.total} total points.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button className="b sm alt" onClick={() => addLeg(spreadLeg(g, g.home))}>
                + {g.home} spread
              </button>
              <button className="b sm alt" onClick={() => addLeg(spreadLeg(g, g.away))}>
                + {g.away} spread
              </button>
              <button className="b sm alt" onClick={() => addLeg(totalLeg(g, "under"))}>
                + Game total Under
              </button>
              <button className="b sm alt" onClick={() => addLeg(totalLeg(g, "over"))}>
                + Game total Over
              </button>
              <button className="b sm alt" onClick={() => addLeg(teamTotalLeg(g, g.home, "under"))}>
                + {g.home} team total Under
              </button>
              <button className="b sm alt" onClick={() => addLeg(teamTotalLeg(g, g.away, "under"))}>
                + {g.away} team total Under
              </button>
            </div>
            <div className="text-xs" style={{ color: "var(--mut)", marginTop: 6 }}>
              Legs are added at -110. Change the odds in the table above to match your sportsbook&apos;s price and
              line. Player props are added from the Props tab.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
