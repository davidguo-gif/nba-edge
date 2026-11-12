"use client";

import { useNBA } from "@/lib/NBAContext";
import { fmtO, totalLean, scheduleSpots } from "@/lib/nba";

export function SlateTab() {
  const { state } = useNBA();
  const { SLATE, T } = state;

  return (
    <div>
      <h2>Tonight&apos;s Slate</h2>
      <p className="sub">
        Model spreads/totals and rest analysis. Click a game for situational spots.
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
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: "var(--mut)" }}>Spread</span>
                    <br />
                    <span
                      className={g.spread < 0 ? "ok" : g.spread > 0 ? "bad" : ""}
                    >
                      {g.home} {g.spread > 0 ? "+" : ""}
                      {g.spread}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--mut)" }}>Total</span>
                    <br />
                    {g.total}
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--mut)" }}>Pace</span>
                    <br />
                    {g.pace.toFixed(1)}
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--mut)" }}>Rest</span>
                    <br />
                    <span className="text-xs">
                      {T[g.home]?.abbr}:{g.hRest}d / {T[g.away]?.abbr}:{g.aRest}d
                    </span>
                  </div>
                  <div>
                    <span className="tag" style={{
                      background: tl[1] === "ok" ? "#166534" : tl[1] === "bad" ? "#7f1d1d" : tl[1] === "warn" ? "#713f12" : "#1e293b",
                      color: tl[1] === "ok" ? "#86efac" : tl[1] === "bad" ? "#fca5a5" : tl[1] === "warn" ? "#fcd34d" : "#94a3b8",
                    }}>
                      {tl[0]}
                    </span>
                  </div>
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
                      <b>Model projection</b>: {T[g.away]?.abbr} {fmtO(
                        -Math.round(g.spread * 2) / 2
                      )} | O/U {g.total}
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