"use client";

import { useState, useEffect } from "react";
import { useNBA } from "@/lib/NBAContext";
import { BOOK_URLS, type PropBook, type SlateGame } from "@/types";
import { fmtO, decOdds, clamp, windows, hit, defChip, md } from "@/lib/nba";

const MK: Record<string, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  fg3: "3PM",
  pra: "PRA",
};
const MS: Record<string, string> = {
  pts: "Points",
  reb: "Rebounds",
  ast: "Assists",
  fg3: "3-Pointers",
  pra: "Pts+Reb+Ast",
};

export function PropsTab() {
  const { state, addBet } = useNBA();
  const { SLATE, PROPS, T, CTX, PLAYERS } = state;
  const [apiKey, setApiKey] = useState("");
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [oddsStatus, setOddsStatus] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [leanFilter, setLeanFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  const filteredGames =
    gameFilter === "all" ? SLATE : SLATE.filter((g: SlateGame) => g.home === gameFilter || g.away === gameFilter);

  const mf = marketFilter === "all" ? undefined : marketFilter;

  const filteredProps = PROPS.filter((p) => {
    const pl = PLAYERS[p.pid];
    if (!pl) return false;
    const c = CTX[pl.team];
    if (!c) return false;
    const gm = SLATE[c.gid];
    if (!gm) return false;
    if (gameFilter !== "all" && !filteredGames.includes(gm)) return false;
    if (mf && p.market !== mf) return false;
    if (searchQ && !pl.name.toLowerCase().includes(searchQ.toLowerCase())) return false;

    const w = windows(pl);
    const h = {
      l10: hit(w.l10, p.market, p.line),
      l15: hit(w.l15, p.market, p.line),
      y26: hit(w.y26, p.market, p.line),
    };
    const rank = T[c.opp]?.rank[pl.pos]?.[p.market] || 15;
    const defAdj = ((rank - 15.5) / 14.5) * 0.04;
    const est = (ln: number) => {
      const hh = [
        hit(w.l10, p.market, ln),
        hit(w.l15, p.market, ln),
        hit(w.y26, p.market, ln),
      ];
      const hr = 0.5 * hh[0].p + 0.3 * hh[1].p + 0.2 * hh[2].p;
      return clamp(0.5 + (hr - 0.5) * 0.6 + defAdj, 0.25, 0.75);
    };
    let best: any = null;
    p.books.forEach((b) => {
      const pO = est(b.line);
      [{ side: "over", p: pO, odds: b.over }, { side: "under", p: 1 - pO, odds: b.under }].forEach(
        ({ side, p: prob, odds: o }) => {
          const ev = prob * (decOdds(o) - 1) - (1 - prob);
          if (!best || ev > best.ev) best = { book: b.book, side, line: b.line, odds: o, ev, p: prob };
        },
      );
    });
    const conf = best?.ev >= 0.08 ? "Strong" : best?.ev >= 0.03 ? "Lean" : "Pass";

    if (leanFilter === "strong" && conf !== "Strong") return false;
    if (leanFilter === "lean" && conf !== "Strong" && conf !== "Lean") return false;
    (p as any)._analysis = { ...h, rank, defAdj, best, conf };
    return true;
  });

  useEffect(() => {
    const stored = localStorage.getItem("nbaedge.apikey");
    if (stored) setApiKey(stored);
  }, []);

  const fetchOdds = async () => {
    if (!apiKey) return;
    setLoadingOdds(true);
    setOddsStatus("Fetching odds...");
    try {
      const res = await fetch(`/api/odds?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to fetch odds");
      }
      localStorage.setItem("nbaedge.apikey", apiKey);
      setOddsStatus("Odds loaded! Reloading...");
      // Reload the page to re-process with new props
      window.location.reload();
    } catch (e: any) {
      setOddsStatus("Error: " + e.message);
    } finally {
      setLoadingOdds(false);
    }
  };

  return (
    <div>
      <h2>Player Props</h2>
      <p className="sub">
        Use The Odds API key to fetch live lines. Click &ldquo;Add bet&rdquo; to
        track a prop.
      </p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form">
          <label>
            The Odds API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your key"
            />
          </label>
          <button
            className="b"
            onClick={fetchOdds}
            disabled={loadingOdds || !apiKey}
          >
            {loadingOdds ? "Loading..." : "Fetch live odds"}
          </button>
          {oddsStatus && (
            <span className="note">{oddsStatus}</span>
          )}
          <button
            className="b alt sm"
            onClick={() => {
              localStorage.removeItem("nbaedge.apikey");
              window.location.reload();
            }}
          >
            Clear &amp; reload
          </button>
        </div>
      </div>

      <div className="filters">
        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
        >
          <option value="all">All games</option>
          {SLATE.map((g, i) => (
            <option key={i} value={g.home}>
              {g.away} @ {g.home}
            </option>
          ))}
        </select>
        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
        >
          <option value="all">All markets</option>
          {Object.entries(MK).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={leanFilter}
          onChange={(e) => setLeanFilter(e.target.value)}
        >
          <option value="all">All confidence</option>
          <option value="strong">Strong only</option>
          <option value="lean">Leans &amp; Strong</option>
        </select>
        <input
          placeholder="Search player..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <span className="note">{filteredProps.length} props</span>
      </div>

      <div className="grid g2">
        {filteredProps.map((p: any, i: number) => {
          const pl = PLAYERS[p.pid];
          if (!pl) return null;
          const a = p._analysis;
          const c = CTX[pl.team];
          const gm = c ? SLATE[c.gid] : null;

          return (
            <div key={i} className="card">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <b>{pl.name}</b>{" "}
                  <span className="note">
                    ({pl.team} {pl.pos})
                  </span>
                  {gm && (
                    <span className="note">
                      {" "}
                      @ {pl.team === gm.home ? gm.away : gm.home}
                    </span>
                  )}
                </div>
                <span
                  className={`tag ${a.conf === "Strong" ? "ok" : a.conf === "Lean" ? "warn" : ""}`}
                  style={a.conf === "Pass" ? { background: "#1e293b", color: "#94a3b8" } : {}}
                >
                  {a.conf}
                </span>
              </div>
              <div className="text-sm" style={{ marginBottom: 4 }}>
                {MS[p.market]}: <b>{p.line}</b> (proj {p.proj})
              </div>
              <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 6 }}>
                L10: {a.l10.o}-{a.l10.u} | L15: {a.l15.o}-{a.l15.u} | 2026:{" "}
                {a.y26.o}-{a.y26.u} | Def rank: {defChip(a.rank)}
              </div>
              <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {p.books.map((b: PropBook, bi: number) => (
                  <div
                    key={bi}
                    className="text-xs"
                    style={{
                      background: "var(--bg)",
                      padding: "4px 6px",
                      borderRadius: 4,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {BOOK_URLS[b.book] ? (
                        <a
                          href={BOOK_URLS[b.book]}
                          target="_blank"
                          rel="noopener"
                        >
                          {b.book}
                        </a>
                      ) : (
                        b.book
                      )}
                    </span>
                    <span>
                      {fmtO(b.over)}/{fmtO(b.under)}{" "}
                      {b.line !== p.line ? `@${b.line}` : ""}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                <button
                  className="b sm alt"
                  onClick={() =>
                    addBet(
                      `${pl.name} O ${p.line} ${MK[p.market]}`,
                      a.best.book,
                      a.best.odds,
                      1,
                    )
                  }
                >
                  +Bet Over
                </button>
                <button
                  className="b sm alt"
                  onClick={() =>
                    addBet(
                      `${pl.name} U ${p.line} ${MK[p.market]}`,
                      a.best.book,
                      a.best.odds,
                      1,
                    )
                  }
                >
                  +Bet Under
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}