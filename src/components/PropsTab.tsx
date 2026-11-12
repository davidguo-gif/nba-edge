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

// best available price for one side across books
function bestSide(books: PropBook[], side: "over" | "under") {
  let best = { book: books[0].book, line: books[0].line, price: books[0][side] };
  books.forEach((b) => {
    if (decOdds(b[side]) > decOdds(best.price)) best = { book: b.book, line: b.line, price: b[side] };
  });
  return best;
}

export function PropsTab() {
  const { state, addBet, applyOdds } = useNBA();
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
      const odds = await res.json();
      await applyOdds(odds);
      setOddsStatus(
        `Loaded ${odds.props.length} lines across ${odds.games.length} games`,
      );
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
              localStorage.removeItem("nbaedge.odds");
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
                  title="Strong: 8%+ edge, Lean: 3-8% edge, Pass: under 3%"
                  className={`tag ${a.conf === "Strong" ? "ok" : a.conf === "Lean" ? "warn" : ""}`}
                  style={a.conf === "Pass" ? { background: "#1e293b", color: "#94a3b8" } : {}}
                >
                  {a.conf}
                </span>
              </div>
              <div style={{ marginBottom: 4 }}>
                <b>{MS[p.market]}: Over/Under {p.line}</b>
                <span className="note">
                  {" "}— {p.market === "pra" ? "points + rebounds + assists" : MS[p.market].toLowerCase()} in this game
                </span>
              </div>
              <div className="text-sm" style={{ marginBottom: 6 }}>
                {a.best.ev >= 0.03 ? (
                  <>
                    Best play: <b>{a.best.side === "over" ? "Over" : "Under"} {a.best.line}</b>{" "}
                    at {a.best.book} ({fmtO(a.best.odds)}). We give it a{" "}
                    <b>{Math.round(a.best.p * 100)}%</b> chance to hit, which beats the{" "}
                    {Math.round((1 / decOdds(a.best.odds)) * 100)}% the odds imply by{" "}
                    <b>{(a.best.ev * 100).toFixed(1)}%</b> of the stake.
                  </>
                ) : (
                  <span style={{ color: "var(--mut)" }}>
                    No clear edge: the odds already match how often this tends to hit.
                  </span>
                )}
              </div>
              <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 2 }}>
                Season average: <b>{p.proj}</b> {MK[p.market]} per game
                {pl.min ? ` (${Math.round(pl.min)} min)` : ""}
              </div>
              <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 2 }}>
                Went over {p.line} in {a.l10.o} of the last {a.l10.o + a.l10.u} games
                (last 15: {a.l15.o} of {a.l15.o + a.l15.u}; this season:{" "}
                {a.y26.o} of {a.y26.o + a.y26.u})
              </div>
              <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 6 }}>
                Opponent defense vs {pl.pos || "this position"}: {defChip(a.rank)}{" "}
                {a.rank >= 21 ? "(allows a lot, good for Over)" : a.rank <= 10 ? "(tough, good for Under)" : "(average)"}
              </div>
              <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 2 }}>
                Sportsbook prices (Over / Under):
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
                      O {fmtO(b.over)} / U {fmtO(b.under)}{" "}
                      {b.line !== p.line ? `(line ${b.line})` : ""}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                <button
                  className="b sm alt"
                  onClick={() => {
                    const o = bestSide(p.books, "over");
                    addBet(`${pl.name} Over ${o.line} ${MS[p.market]}`, o.book, o.price, 1);
                  }}
                >
                  +Bet Over
                </button>
                <button
                  className="b sm alt"
                  onClick={() => {
                    const o = bestSide(p.books, "under");
                    addBet(`${pl.name} Under ${o.line} ${MS[p.market]}`, o.book, o.price, 1);
                  }}
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