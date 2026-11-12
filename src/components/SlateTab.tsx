"use client";

import React, { useEffect, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { totalLean, scheduleSpots, restTxt, teamRank, ord, TIME_OPTIONS } from "@/lib/nba";
import type { TeamData, SlateGame } from "@/types";

const tierCls = (r: number) => (r <= 10 ? "ok" : r >= 21 ? "bad" : "");
const paceWord = (p: number) => (p >= 100 ? "fast" : p <= 98.5 ? "slow" : "avg");

function GameAnalysis({ g }: { g: SlateGame }) {
  const { state } = useNBA();
  const { T } = state;
  const spots = scheduleSpots(g);
  const tl = totalLean(g);

  const h = T[g.home];
  const a = T[g.away];
  const hO = h ? teamRank(T, g.home, "ortg") : 15;
  const hD = h ? teamRank(T, g.home, "drtg") : 15;
  const aO = a ? teamRank(T, g.away, "ortg") : 15;
  const aD = a ? teamRank(T, g.away, "drtg") : 15;

  const margin = g.spread === 0 ? "toss-up" : `${g.spread < 0 ? g.home : g.away} by ${Math.abs(g.spread)}`;

  return (
    <tr className="expand-row">
      <td colSpan={8} style={{ padding: 0, borderBottom: "2px solid var(--blue)" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ padding: "12px 16px", cursor: "default", background: "rgba(59,130,246,0.04)" }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Game Analysis — {g.away} @ {g.home}</h3>

          <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Team stats</h4>
              <table className="mini" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Team</th><th>ORTG</th><th>DRTG</th><th>Pace</th><th>Rest</th><th>B2B</th><th>4in5</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>{g.home}</b></td>
                    <td className={tierCls(hO)}>{h ? `${h.ortg.toFixed(1)} (${ord(hO)})` : "—"}</td>
                    <td className={tierCls(hD)}>{h ? `${h.drtg.toFixed(1)} (${ord(hD)})` : "—"}</td>
                    <td>{h ? h.pace.toFixed(1) : "—"}</td>
                    <td>{restTxt(g.hRest)}</td>
                    <td>{g.hRest === 0 ? "⚠" : "—"}</td>
                    <td>{g.hFour ? "⚠" : "—"}</td>
                  </tr>
                  <tr>
                    <td><b>{g.away}</b></td>
                    <td className={tierCls(aO)}>{a ? `${a.ortg.toFixed(1)} (${ord(aO)})` : "—"}</td>
                    <td className={tierCls(aD)}>{a ? `${a.drtg.toFixed(1)} (${ord(aD)})` : "—"}</td>
                    <td>{a ? a.pace.toFixed(1) : "—"}</td>
                    <td>{restTxt(g.aRest)}</td>
                    <td>{g.aRest === 0 ? "⚠" : "—"}</td>
                    <td>{g.aFour ? "⚠" : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Total projection</h4>
              <ul className="clean text-sm">
                <li className="row">
                  <b>Model:</b> {margin}, ~{g.total} pts
                </li>
                <li className="row">
                  <b>Pace:</b> {g.pace.toFixed(1)} ({paceWord(g.pace)})
                </li>
                <li className="row">
                  <b>Lean:</b> <span style={{
                    color: tl[1] === "ok" ? "var(--green)" : tl[1] === "bad" ? "var(--red)" : tl[1] === "warn" ? "#fcd34d" : "var(--mut)"
                  }}><b>{tl[0]}</b></span> — {tl[2]}
                </li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Situational spots</h4>
            {spots.length > 0 ? (
              <ul className="clean text-sm">
                {spots.map((s, i) => (
                  <li key={i} className="row">
                    <span><b>{s.t}</b> → {s.l}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs note">No rest or fatigue edge in this game.</div>
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Quick bets</h4>
            <ul className="clean text-sm">
              {(g.hRest === 0 && g.aRest >= 1) && (
                <li className="row"><span><b>Fade {g.home}:</b> spread on {g.away}, game total Under — {g.home} on B2B vs rested {g.away}</span></li>
              )}
              {(g.aRest === 0 && g.hRest >= 1) && (
                <li className="row"><span><b>Fade {g.away}:</b> spread on {g.home}, game total Under — {g.away} on B2B vs rested {g.home}</span></li>
              )}
              {(g.hRest === 0 && g.aRest === 0) && (
                <li className="row"><span><b>Both B2B:</b> game total Under — tired legs, slow pace, sloppy play</span></li>
              )}
              {(g.hFour || g.aFour) && (
                <li className="row"><span><b>Fatigue spot:</b> Under on totals, fade tired team — 4 games in 5 nights</span></li>
              )}
              {(Math.abs(g.spread) <= 5) && (
                <li className="row"><span><b>Close game:</b> Q4 Under / live Under, star props Over (starters play more minutes)</span></li>
              )}
              {(g.pace >= 100 && g.hRest >= 1 && g.aRest >= 1) && (
                <li className="row"><span><b>Fast + rested:</b> game total Over — both teams fresh and pushing pace</span></li>
              )}
              {(g.pace <= 98.5 && (g.hRest === 0 || g.aRest === 0)) && (
                <li className="row"><span><b>Slow + tired:</b> game total Under — slow pace meets fatigue</span></li>
              )}
            </ul>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function SlateTab() {
  const { state, focus, clearFocus, timeHorizon } = useNBA();
  const { SLATE, T } = state;
  const [hl, setHl] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const nowMs = Date.now();
  const cutoff = timeHorizon === 0 ? Infinity : nowMs + timeHorizon * 3600e3;

  const filteredSlate = SLATE.filter((g) => {
    if (!g.dt) return true;
    return new Date(g.dt).getTime() <= cutoff;
  });

  useEffect(() => {
    if (!focus || focus.tab !== "slate" || focus.gameId == null) return;
    const id = focus.gameId;
    clearFocus();
    setHl(id);
    setTimeout(() => {
      const el = document.getElementById(`slate-row-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    setTimeout(() => setHl(null), 3000);
  }, [focus, clearFocus]);

  const toggleGame = (id: number) => {
    setExpanded(expanded === id ? null : id);
  };

  return (
    <div>
      <h2>Slate</h2>
      <p className="sub">Our projections (not sportsbook lines). Rankings: 1 = best of 30 teams. Click a game for full analysis.</p>
      {SLATE.length === 0 ? (
        <p className="note">No games scheduled. Check back later.</p>
      ) : (
        <>
          <div className="filters">
            <span className="note">{filteredSlate.length} of {SLATE.length} game{SLATE.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Time</th>
                  <th className="num">Pick</th>
                  <th className="num">Total</th>
                  <th className="num">Pace</th>
                  <th>Off / Def</th>
                  <th>Rest</th>
                  <th>Lean</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlate.map((g) => {
                  const tl = totalLean(g);
                  const leanColor =
                    tl[1] === "ok" ? "var(--green)" : tl[1] === "bad" ? "var(--red)" : tl[1] === "warn" ? "#fcd34d" : "var(--mut)";
                  return (
                    <React.Fragment key={g.id}>
                      <tr
                        id={`slate-row-${g.id}`}
                        onClick={() => toggleGame(g.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <b>{g.away}</b> @ <b>{g.home}</b>
                        </td>
                        <td className="note">{g.dt ? new Date(g.dt).toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + new Date(g.dt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : g.time}</td>
                        <td className="num">
                          {g.spread === 0 ? "—" : `${g.spread < 0 ? g.home : g.away} ${g.spread > 0 ? "+" : ""}${g.spread}`}
                        </td>
                        <td className="num">{g.total}</td>
                        <td className="num">
                          {g.pace.toFixed(1)}
                          <div className="text-xs note">{paceWord(g.pace)}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {[g.home, g.away].map((ab) => {
                            const t: TeamData | undefined = T[ab];
                            if (!t) return null;
                            const o = teamRank(T, ab, "ortg"), d = teamRank(T, ab, "drtg");
                            return (
                              <div key={ab}>
                                <b>{ab}</b>: O<b className={tierCls(o)}>{ord(o)}</b> D<b className={tierCls(d)}>{ord(d)}</b>
                              </div>
                            );
                          })}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {T[g.home]?.abbr} {restTxt(g.hRest)}
                          <br />
                          {T[g.away]?.abbr} {restTxt(g.aRest)}
                          {(g.hFour || g.aFour) && <div className="text-xs note">4-in-5</div>}
                        </td>
                        <td>
                          <span className="tag" style={{ background: `${leanColor}15`, color: leanColor }}>
                            {tl[0]}
                          </span>
                        </td>
                      </tr>
                      {expanded === g.id && (
                        <GameAnalysis g={g} />
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}