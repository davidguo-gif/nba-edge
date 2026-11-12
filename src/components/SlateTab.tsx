"use client";

import { useEffect, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { totalLean, scheduleSpots, restTxt, teamRank, ord } from "@/lib/nba";
import type { TeamData } from "@/types";

const tier = (r: number) => (r <= 10 ? "strong" : r >= 21 ? "weak" : "avg");
const tierCls = (r: number) => (r <= 10 ? "ok" : r >= 21 ? "bad" : "");
const paceWord = (p: number) => (p >= 100 ? "fast" : p <= 98.5 ? "slow" : "avg");

export function SlateTab() {
  const { state, focus, clearFocus } = useNBA();
  const { SLATE, T } = state;
  const [hl, setHl] = useState<number | null>(null);
  const [showSpots, setShowSpots] = useState(false);

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
  }, [focus]);

  return (
    <div>
      <h2>Tonight&apos;s Slate</h2>
      <p className="sub">Our projections (not sportsbook lines). Rankings: 1 = best of 30 teams.</p>
      {SLATE.length === 0 ? (
        <p className="note">No games scheduled for tonight. Check back later.</p>
      ) : (
        <>
          <div className="filters">
            <label className="row" style={{ fontSize: 12 }}>
              <input type="checkbox" checked={showSpots} onChange={() => setShowSpots(!showSpots)} />
              Show situational spots
            </label>
            <span className="note">{SLATE.length} games</span>
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
                {SLATE.map((g) => {
                  const tl = totalLean(g);
                  const leanColor =
                    tl[1] === "ok" ? "var(--green)" : tl[1] === "bad" ? "var(--red)" : tl[1] === "warn" ? "#fcd34d" : "var(--mut)";
                  return (
                    <tr
                      key={g.id}
                      id={`slate-row-${g.id}`}
                      onClick={() => setShowSpots(!showSpots)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <b>{g.away}</b> @ <b>{g.home}</b>
                      </td>
                      <td className="note">{g.time}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {showSpots && (
            <div className="grid g3" style={{ marginTop: 12 }}>
              {SLATE.map((g) => {
                const spots = scheduleSpots(g);
                const tl = totalLean(g);
                return (
                  <div key={g.id} className="card">
                    <div className="text-sm" style={{ marginBottom: 2 }}>
                      <b>{g.away}</b> @ <b>{g.home}</b>
                    </div>
                    <ul className="clean text-xs" style={{ color: "var(--mut)" }}>
                      {spots.length ? spots.map((s, i) => (
                        <li key={i}><b>{s.t}</b> → {s.l}</li>
                      )) : <li>No rest/fatigue edge</li>}
                      <li className="note" style={{ marginTop: 2 }}>
                        Model: {g.spread === 0 ? "toss-up" : `${g.spread < 0 ? g.home : g.away} by ${Math.abs(g.spread)}`}, ~{g.total} pts — {tl[2]}
                      </li>
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}