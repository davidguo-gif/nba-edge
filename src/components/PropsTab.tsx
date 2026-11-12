"use client";

import { useState, useEffect } from "react";
import { useNBA } from "@/lib/NBAContext";
import type { SlateGame } from "@/types";
import { MARKET_NAMES } from "@/types";
import { decOdds, clamp, windows, hit } from "@/lib/nba";
import { PropCardRow } from "./PropCard";

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
  const [sortCol, setSortCol] = useState(""); // column key
  const [sortDir, setSortDir] = useState(1);
  const [maxHours, setMaxHours] = useState(32); // default ~1.3 days (today)

  const TIME_OPTIONS = [
    { value: 24, label: "Today" },
    { value: 48, label: "2 days" },
    { value: 72, label: "3 days" },
    { value: 120, label: "5 days" },
    { value: 168, label: "1 week" },
    { value: 336, label: "2 weeks" },
    { value: 0, label: "All" },
  ];
  const currentTimeLabel = TIME_OPTIONS.find((o) => o.value === maxHours)?.label || `${Math.round(maxHours / 24)}d`;

  const filteredGames =
    gameFilter === "all" ? SLATE : SLATE.filter((g: SlateGame) => g.home === gameFilter || g.away === gameFilter);

  // time-horizon cutoff
  const now = new Date().getTime();
  const horizonCutoff = maxHours === 0 ? Infinity : now + maxHours * 3600e3;

  const mf = marketFilter === "all" ? undefined : marketFilter;

  const rawProps = PROPS.filter((p) => {
    const pl = PLAYERS[p.pid];
    if (!pl) return false;
    const c = CTX[pl.team];
    if (!c) return false;
    const gm = SLATE[c.gid];
    if (!gm) return false;
    if (gameFilter !== "all" && !filteredGames.includes(gm)) return false;
    // time-horizon: skip games beyond the selected window
    if (gm.dt && maxHours > 0) {
      const gameTime = new Date(gm.dt).getTime();
      if (gameTime > horizonCutoff) return false;
    }
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

  // sorting
  const colSorter = (p: any): string | number => {
    const pl = PLAYERS[p.pid];
    if (!pl) return 0;
    const a = p._analysis;
    switch (sortCol) {
      case "player": return pl.name;
      case "game": return pl.team;
      case "market": return p.market;
      case "line": return p.line;
      case "edge": return a.best?.ev ?? -1;
      case "hit": {
        const w = windows(pl, state.seasonStart);
        const r = w.cur.length ? w.cur.filter((g: any) => g[p.market] > p.line).length / w.cur.length : 0;
        return r;
      }
      case "conf": return { Strong: 3, Lean: 2, Pass: 1 }[a.conf] ?? 0;
      case "def": return a.rank ?? 15;
      default: return 0;
    }
  };
  const sorted = sortCol
    ? [...rawProps].sort((a, b) => {
        const va = colSorter(a), vb = colSorter(b);
        const d = typeof va === "string" ? String(va).localeCompare(String(vb)) : (va as number) - (vb as number);
        return d * sortDir || 0;
      })
    : rawProps;

  useEffect(() => {
    const stored = localStorage.getItem("nbaedge.apikey");
    if (stored) setApiKey(stored);
  }, []);

  // focus from parlay leg
  useEffect(() => {
    if (!focus || focus.tab !== "props") return;
    const p = PROPS.find((x) => PLAYERS[x.pid]?.name === focus.player && x.market === focus.market);
    if (!p) { setAdded("That prop isn't loaded right now."); clearFocus(); return; }
    setGameFilter("all"); setMarketFilter("all"); setLeanFilter("all"); setSearchQ("");
    setOpen(p.id);
    clearFocus();
    setTimeout(() => {
      document.getElementById(`prop-row-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [focus]);

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

  const toggleSort = (c: string) => {
    if (sortCol === c) setSortDir(-sortDir);
    else { setSortCol(c); setSortDir(1); }
  };
  const sc = (c: string) => sortCol === c ? (sortDir > 0 ? " ▲" : " ▼") : "";

  return (
    <div>
      <h2>Player Props</h2>
      <p className="sub">Fetch live lines with your Odds API key. Click a row for the full breakdown with graph and line slider.</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form">
          <label>
            API key
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="the-odds-api.com key" />
          </label>
          <button className="b" onClick={fetchOdds} disabled={loadingOdds || !apiKey}>
            {loadingOdds ? "Loading..." : "Fetch odds"}
          </button>
          {oddsStatus && <span className="note">{oddsStatus}</span>}
          <button className="b alt sm" onClick={() => {
            localStorage.removeItem("nbaedge.apikey");
            localStorage.removeItem("nbaedge.odds");
            window.location.reload();
          }}>Clear</button>
        </div>
      </div>

      <div className="filters">
        <select value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>
          <option value="all">All games</option>
          {SLATE.map((g, i) => (<option key={i} value={g.home}>{g.away} @ {g.home}</option>))}
        </select>
        <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}>
          <option value="all">All markets</option>
          {Object.entries(MARKET_NAMES).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
        <select value={leanFilter} onChange={(e) => setLeanFilter(e.target.value)}>
          <option value="all">All conf</option>
          <option value="strong">Strong only</option>
          <option value="lean">Lean & Strong</option>
        </select>
        <input placeholder="Search player..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} style={{ maxWidth: 180 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap" }}>
          <span>⏰ {currentTimeLabel}</span>
          <input
            type="range"
            min={0}
            max={TIME_OPTIONS.length - 1}
            step={1}
            value={Math.max(0, TIME_OPTIONS.findIndex((o) => o.value === maxHours))}
            onChange={(e) => setMaxHours(TIME_OPTIONS[+e.target.value].value)}
            style={{ width: 72, cursor: "pointer" }}
            title={`Show props within ${currentTimeLabel}`}
          />
        </label>
        <span className="note">{sorted.length} props</span>
        {added && <span className="note ok">{added}</span>}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort("player")}>Player{sc("player")}</th>
              <th onClick={() => toggleSort("game")}>Game{sc("game")}</th>
              <th onClick={() => toggleSort("market")}>Market{sc("market")}</th>
              <th onClick={() => toggleSort("line")} className="num">Line{sc("line")}</th>
              <th onClick={() => toggleSort("edge")}>Pick / Edge{sc("edge")}</th>
              <th onClick={() => toggleSort("hit")}>Hit rate{sc("hit")}</th>
              <th onClick={() => toggleSort("def")} className="num">Def{sc("def")}</th>
              <th onClick={() => toggleSort("conf")}>Conf{sc("conf")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p: any) => {
              const pl = PLAYERS[p.pid];
              if (!pl) return null;
              const c = CTX[pl.team];
              const gm = c ? SLATE[c.gid] : null;
              return (
                <PropCardRow
                  key={p.id}
                  p={p}
                  pl={pl}
                  gm={gm}
                  a={p._analysis}
                  open={open === p.id}
                  onToggle={() => setOpen(open === p.id ? null : p.id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}