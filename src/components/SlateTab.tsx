"use client";

import { useNBA } from "@/lib/NBAContext";
import { totalLean, scheduleSpots, restTxt, teamRank, ord } from "@/lib/nba";
import type { TeamData } from "@/types";

const tier = (r: number) => (r <= 10 ? "Strong" : r >= 21 ? "Weak" : "Average");
const tierCls = (r: number) => (r <= 10 ? "ok" : r >= 21 ? "bad" : "");

const paceWord = (p: number) => (p >= 100 ? "fast" : p <= 98.5 ? "slow" : "average");

export function SlateTab() {
  const { state } = useNBA();
  const { SLATE, T } = state;

  return (
    <div>
      <h2>Tonight&apos;s Slate</h2>
      <p className="sub">
        Our own model's projected winner, margin and total points for each game (not sportsbook lines),
        plus how rested each team is. Open "Situational spots" on a game for betting angles.
      </p>
      {SLATE.length === 0 ? (
        <p className="note">No games scheduled for tonight. Check back later.</p>
      ) : (
        <div className="grid g2">
          {SLATE.map((g) => {
            const tl = totalLean(g);
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
                <div className="text-sm" style={{ marginBottom: 4 }}>
                  <span className="text-xs" style={{ color: "var(--mut)" }}>Projected winner: </span>
                  <b>
                    {g.spread === 0
                      ? "Toss-up"
                      : `${g.spread < 0 ? g.home : g.away} by ${Math.abs(g.spread)}`}
                  </b>
                  <span className="text-xs" style={{ color: "var(--mut)" }}>
                    {" "}
                    ({g.spread < 0 ? `${g.home} at home` : g.spread > 0 ? `${g.away} on the road` : "even"})
                  </span>
                </div>
                <div className="text-sm" style={{ marginBottom: 4 }}>
                  <span className="text-xs" style={{ color: "var(--mut)" }}>Projected total points: </span>
                  <b>{g.total}</b>
                  <span className="text-xs" style={{ color: "var(--mut)" }}>
                    {" "}(both teams combined)
                  </span>
                </div>
                {[g.home, g.away].map((ab) => {
                  const t: TeamData | undefined = T[ab];
                  if (!t) return null;
                  const o = teamRank(T, ab, "ortg"),
                    d = teamRank(T, ab, "drtg");
                  return (
                    <div key={ab} className="text-xs" style={{ color: "var(--mut)", marginBottom: 2 }}>
                      <b>{ab}</b>: <b className={tierCls(o)}>{tier(o)} offense</b> ({ord(o)} best of 30, scores{" "}
                      {t.ortg.toFixed(1)} per 100 possessions) and <b className={tierCls(d)}>{tier(d)} defense</b>{" "}
                      ({ord(d)} best of 30, allows {t.drtg.toFixed(1)})
                    </div>
                  );
                })}
                <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 2 }}>
                  Pace: {g.pace.toFixed(1)} possessions per 48 min ({paceWord(g.pace)})
                </div>
                <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 6 }}>
                  Rest: {T[g.home]?.abbr} {restTxt(g.hRest)} | {T[g.away]?.abbr} {restTxt(g.aRest)}
                  {g.hFour || g.aFour ? " (4 games in 5 nights: tired legs)" : ""}
                </div>
                <div className="text-sm">
                  <span className="text-xs" style={{ color: "var(--mut)" }}>Total points lean: </span>
                  <span className="tag" style={{
                    background: tl[1] === "ok" ? "#166534" : tl[1] === "bad" ? "#7f1d1d" : tl[1] === "warn" ? "#713f12" : "#1e293b",
                    color: tl[1] === "ok" ? "#86efac" : tl[1] === "bad" ? "#fca5a5" : tl[1] === "warn" ? "#fcd34d" : "#94a3b8",
                  }}>
                    {tl[0]}
                  </span>
                  <span className="text-xs" style={{ color: "var(--mut)" }}> {tl[2]}</span>
                </div>
                <details className="mt-2">
                  <summary className="text-xs" style={{ color: "var(--blue)", cursor: "pointer" }}>
                    Situational spots
                  </summary>
                  <ul className="clean text-xs mt-1" style={{ color: "var(--mut)" }}>
                    {scheduleSpots(g).map((s, i) => (
                      <li key={i}>
                        <b>{s.t}</b>: {s.l}
                      </li>
                    ))}
                    <li>
                      <b>Model projection</b>:{" "}
                      {g.spread === 0
                        ? "toss-up"
                        : `${g.spread < 0 ? g.home : g.away} wins by ${Math.abs(g.spread)}`}
                      , about {g.total} total points
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