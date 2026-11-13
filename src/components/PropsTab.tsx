"use client";

import { useState, useEffect } from "react";
import { useNBA } from "@/lib/NBAContext";
import type { SlateGame } from "@/types";
import { MARKET_NAMES } from "@/types";
import { decOdds, clamp, windows, hit, record, consensusProb, calculateBetRating } from "@/lib/nba";
import { PropCardRow } from "./PropCard";

export function PropsTab() {
  const { state, applyOdds, focus, clearFocus, timeHorizon, setTimeHorizon } = useNBA();
  const { SLATE, PROPS, T, CTX, PLAYERS } = state;
  const [apiKey, setApiKey] = useState("");
  const [sgoKey, setSgoKey] = useState("");
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

  const filteredGames =
    gameFilter === "all" ? SLATE : SLATE.filter((g: SlateGame) => g.home === gameFilter || g.away === gameFilter);

  // time-horizon cutoff (shared from context)
  const now = new Date().getTime();
  const horizonCutoff = timeHorizon === 0 ? Infinity : now + timeHorizon * 3600e3;

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
    if (gm.dt && timeHorizon > 0) {
      const gameTime = new Date(gm.dt).getTime();
      if (gameTime > horizonCutoff) return false;
    }
    if (mf && p.market !== mf) return false;
    if (searchQ && !pl.name.toLowerCase().includes(searchQ.toLowerCase())) return false;

    // Weighted sharp consensus: compute true probability from sharp sportsbooks
    const consOver = consensusProb(p.books, "over");
    const consUnder = consensusProb(p.books, "under");
    // Use the Over consensus probability; the Under is 1 - that
    const baseProbOver = consOver.prob;
    const baseProbUnder = consUnder.prob; // normally 1 - baseProbOver but compute independently

    let best: any = null;
    p.books.forEach((b) => {
      [{ side: "over", p: baseProbOver, odds: b.over }, { side: "under", p: baseProbUnder, odds: b.under }].forEach(
        ({ side, p: prob, odds: o }) => {
          if (o == null) return;
          const ev = prob * (decOdds(o) - 1) - (1 - prob);
          if (!best || ev > best.ev) best = { book: b.book, side, line: b.line, odds: o, ev, p: prob };
        },
      );
    });
    const rank = T[c.opp]?.rank[pl.pos]?.[p.market] || 15;
    const conf = best?.ev >= 0.08 ? "Strong" : best?.ev >= 0.03 ? "Lean" : "Pass";

    if (leanFilter === "strong" && conf !== "Strong") return false;
    if (leanFilter === "lean" && conf !== "Strong" && conf !== "Lean") return false;

    // Calculate bet rating from TopEndSports framework
    const w = windows(pl, state.seasonStart);
    const r10 = record(w.l10, p.market, p.line);
    const rc = record(w.cur, p.market, p.line);
    const rating = calculateBetRating({
      pl,
      gm,
      market: p.market,
      line: p.line,
      opp: c.opp,
      oppName: T[c.opp]?.name || c.opp,
      rank,
      ev: best?.ev ?? 0,
      l10HitRate: r10.pct,
      seasonHitRate: rc.pct,
      injuries: state.injuries,
      T,
    });

    (p as any)._analysis = { rank, defAdj: 0, best, conf, consensus: consOver, rating };
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
      case "rating": return a.rating?.score ?? 0;
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
    const sgo = localStorage.getItem("nbaedge.sgokey");
    if (sgo) setSgoKey(sgo);
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
    if (!apiKey && !sgoKey) return;
    setLoadingOdds(true);
    setOddsStatus("Fetching odds...");
    try {
      let combined: any = null;

      if (apiKey) {
        const res = await fetch(`/api/odds?key=${encodeURIComponent(apiKey)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "Failed to fetch odds");
        }
        localStorage.setItem("nbaedge.apikey", apiKey);
        combined = await res.json();
      }

      if (sgoKey) {
        const sgoRes = await fetch(`/api/odds-sgo?key=${encodeURIComponent(sgoKey)}`);
        if (sgoRes.ok) {
          localStorage.setItem("nbaedge.sgokey", sgoKey);
          const sgoData = await sgoRes.json();
          if (combined) {
            // Merge SGO data into combined
            const existingNames = new Set(combined.props.map((p: any) => p.name + "|" + p.market));
            sgoData.props.forEach((sp: any) => {
              const key = sp.name + "|" + sp.market;
              if (!existingNames.has(key)) {
                combined.props.push(sp);
              } else {
                // Merge books into existing prop
                const existing = combined.props.find((p: any) => p.name + "|" + p.market === key);
                if (existing) {
                  sp.books.forEach((sb: any) => {
                    if (!existing.books.find((eb: any) => eb.book === sb.book)) {
                      existing.books.push(sb);
                    }
                  });
                }
              }
            });
            // Merge games
            sgoData.games.forEach((sg: any) => {
              if (!combined.games.find((g: any) => g.home === sg.home && g.away === sg.away)) {
                combined.games.push(sg);
              }
            });
            setOddsStatus(`Loaded ${combined.props.length} lines (${sgoData.props.length} from sharp/prediction books)`);
          } else {
            combined = sgoData;
          }
        } else {
          const errText = await sgoRes.text().catch(() => "");
          if (!combined) throw new Error(`SGO API: ${sgoRes.status} ${errText}`);
        }
      }

      if (combined) {
        await applyOdds(combined);
        if (!sgoKey) setOddsStatus(`Loaded ${combined.props.length} lines across ${combined.games.length} games`);
        else setOddsStatus(`Loaded ${combined.props.length} lines (from ${apiKey && sgoKey ? "The Odds API + sharp/prediction books" : "sharp/prediction books"})`);
      }
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
            The Odds API key
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="the-odds-api.com key" />
          </label>
          <label>
            Prediction Market API key
            <input type="password" value={sgoKey} onChange={(e) => setSgoKey(e.target.value)} placeholder="predictionmarketapi.com key (Kalshi, Polymarket, Novig)" />
          </label>
          <button className="b" onClick={fetchOdds} disabled={loadingOdds || (!apiKey && !sgoKey)}>
            {loadingOdds ? "Loading..." : "Fetch odds"}
          </button>
          {oddsStatus && <span className="note">{oddsStatus}</span>}
          <button className="b alt sm" onClick={() => {
            localStorage.removeItem("nbaedge.apikey");
            localStorage.removeItem("nbaedge.sgokey");
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
            <th onClick={() => toggleSort("rating")}>Rating{sc("rating")}</th>
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