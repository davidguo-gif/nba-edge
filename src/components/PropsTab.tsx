"use client";

import { useState, useEffect } from "react";
import { useNBA } from "@/lib/NBAContext";
import type { SlateGame } from "@/types";
import { decOdds, clamp, windows, hit } from "@/lib/nba";
import { PropCard } from "./PropCard";

const MK: Record<string, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  fg3: "3PM",
  pra: "PRA",
};

export function PropsTab() {
  const { state, applyOdds, focus, clearFocus } = useNBA();
  const { SLATE, PROPS, T, CTX, PLAYERS } = state;
  const [apiKey, setApiKey] = useState("");
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [oddsStatus, setOddsStatus] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [leanFilter, setLeanFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [added, setAdded] = useState("");

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

    const w = windows(pl, state.seasonStart);
    const rank = T[c.opp]?.rank[pl.pos]?.[p.market] || 15;
    const defAdj = ((rank - 15.5) / 14.5) * 0.04;
    const est = (ln: number) => {
      const hh = [hit(w.l10, p.market, ln), hit(w.l15, p.market, ln), hit(w.cur, p.market, ln)];
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
    (p as any)._analysis = { rank, defAdj, best, conf };
    return true;
  });

  // arriving from a parlay leg: show that prop, expanded, scrolled into view
  useEffect(() => {
    if (!focus || focus.tab !== "props") return;
    const p = PROPS.find(
      (x) => PLAYERS[x.pid]?.name === focus.player && x.market === focus.market,
    );
    if (!p) {
      flash("That prop isn't loaded right now (fetch live odds to see it).");
      clearFocus();
      return;
    }
    setGameFilter("all");
    setMarketFilter("all");
    setLeanFilter("all");
    setSearchQ("");
    setOpen(p.id);
    clearFocus();
    setTimeout(() => {
      document.getElementById(`prop-card-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

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
      setOddsStatus(`Loaded ${odds.props.length} lines across ${odds.games.length} games`);
    } catch (e: any) {
      setOddsStatus("Error: " + e.message);
    } finally {
      setLoadingOdds(false);
    }
  };

  const flash = (msg: string) => {
    setAdded(msg);
    setTimeout(() => setAdded(""), 2500);
  };

  return (
    <div>
      <h2>Player Props</h2>
      <p className="sub">
        Fetch live lines with your Odds API key. Click a card for the game-by-game graph, head-to-head and a line
        slider. &ldquo;+ Parlay&rdquo; sends a pick to the Parlay Builder.
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
          <button className="b" onClick={fetchOdds} disabled={loadingOdds || !apiKey}>
            {loadingOdds ? "Loading..." : "Fetch live odds"}
          </button>
          {oddsStatus && <span className="note">{oddsStatus}</span>}
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
        <select value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>
          <option value="all">All games</option>
          {SLATE.map((g, i) => (
            <option key={i} value={g.home}>
              {g.away} @ {g.home}
            </option>
          ))}
        </select>
        <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}>
          <option value="all">All markets</option>
          {Object.entries(MK).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={leanFilter} onChange={(e) => setLeanFilter(e.target.value)}>
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
        {added && <span className="note ok">{added}</span>}
      </div>

      <div className="grid g2">
        {filteredProps.map((p: any) => {
          const pl = PLAYERS[p.pid];
          if (!pl) return null;
          const c = CTX[pl.team];
          const gm = c ? SLATE[c.gid] : null;
          return (
            <div key={p.id} id={`prop-card-${p.id}`} style={{ scrollMarginTop: 8 }}>
            <PropCard
              p={p}
              pl={pl}
              gm={gm}
              a={p._analysis}
              open={open === p.id}
              onToggle={() => setOpen(open === p.id ? null : p.id)}
              onAdded={flash}
            />
            </div>
          );
        })}
      </div>
    </div>
  );
}
