"use client";

import { useNBA } from "@/lib/NBAContext";
import { totalLean, scheduleSpots, restTxt, teamRank, ord } from "@/lib/nba";
import type { TeamData } from "@/types";

const tier = (r: number) => (r <= 10 ? "strong" : r >= 21 ? "weak" : "avg");
const tierCls = (r: number) => (r <= 10 ? "ok" : r >= 21 ? "bad" : "");
const paceWord = (p: number) => (p >= 100 ? "fast" : p <= 98.5 ? "slow" : "avg");

export function SlateTab() {
  const { state } = useNBA();
  const { SLATE, T } = state;

  return (
    <div>
      <h2>Tonight&apos;s Slate</h2>
      <p className="sub">
        Our own projections (not sportsbook lines) + rest. Rankings are out of 30 teams, 1st = best.
      </p>
      {SLATE.length === 0 ? (
        <p className="note">No games scheduled for tonight. Check back later.</p>
      ) : (
        <div className="grid g2">
          {SLATE.map((g) => {
            const tl = totalLean(g);
            const leanColor =
              tl[1] === "ok" ? "#86efac" : tl[1] === "bad" ? "#fca5a5" : tl[1] === "warn" ? "#fcd34d" : "#94a3b8";
            const leanBg =
              tl[1] === "ok" ? "#166534" : tl[1] === "bad" ? "#7f1d1d" : tl[1] === "warn" ? "#713f12" : "#1e293b";
            return (
              <div key={g.id} className="card">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <b>{g.away}</b> @ <b>{g.home}</b>
                  </div>
                  <div className="text-xs" style={{ color: "var(--mut)" }}>
                    {g.time}
                  </div>
                </div>
                <ul className="clean text-sm" style={{ margin: "2px 0 4px" }}>
                  <li>
                    Pick:{" "}
                    <b>
                      {g.spread === 0
                        ? "toss-up"
                        : `${g.spread < 0 ? g.home : g.away} by ${Math.abs(g.spread)}`}
                    </b>
                    {g.spread !== 0 && (
                      <span className="note"> ({g.spread < 0 ? "home" : "road"})</span>
                    )}
                    {" | "}Total <b>{g.total}</b> pts
                  </li>
                  <li>
                    Pace: <b>{g.pace.toFixed(1)}</b> ({paceWord(g.pace)})
                  </li>
                  {[g.home, g.away].map((ab) => {
                    const t: TeamData | undefined = T[ab];
                    if (!t) return null;
                    const o = teamRank(T, ab, "ortg"),
                      d = teamRank(T, ab, "drtg");
                    return (
                      <li key={ab}>
                        <b>{ab}</b>: off <b className={tierCls(o)}>{ord(o)}</b> ({t.ortg.toFixed(1)}), def{" "}
                        <b className={tierCls(d)}>{ord(d)}</b> ({t.drtg.toFixed(1)}) {"\u2192"} {tier(o)} O / {tier(d)} D
                      </li>
                    );
                  })}
                  <li>
                    Rest: {T[g.home]?.abbr} {restTxt(g.hRest)} | {T[g.away]?.abbr} {restTxt(g.aRest)}
                    {g.hFour || g.aFour ? " | 4 games in 5 nights" : ""}
                  </li>
                  <li>
                    Total lean:{" "}
                    <span className="tag" style={{ background: leanBg, color: leanColor }}>
                      {tl[0]}
                    </span>{" "}
                    <span className="text-xs" style={{ color: "var(--mut)" }}>
                      {tl[2]}
                    </span>
                  </li>
                </ul>
                <details className="mt-2">
                  <summary className="text-xs" style={{ color: "var(--blue)", cursor: "pointer" }}>
                    Situational spots
                  </summary>
                  <ul className="clean text-xs mt-1" style={{ color: "var(--mut)" }}>
                    {scheduleSpots(g).map((s, i) => (
                      <li key={i}>
                        <b>{s.t}</b> {"\u2192"} {s.l}
                      </li>
                    ))}
                    {scheduleSpots(g).length === 0 && <li>none: no rest or fatigue edge</li>}
                    <li>
                      <b>Model</b>:{" "}
                      {g.spread === 0 ? "toss-up" : `${g.spread < 0 ? g.home : g.away} by ${Math.abs(g.spread)}`}, ~
                      {g.total} pts
                    </li>
                  </ul>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
