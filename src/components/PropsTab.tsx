"use client";

import { useState, useEffect } from "react";
import { useNBA } from "@/lib/NBAContext";
import { BOOK_URLS, type PropBook, type SlateGame } from "@/types";
import {
  fmtO,
  decOdds,
  clamp,
  windows,
  hit,
  record,
  defExplain,
  prevSeasonLabel,
  mktWord,
  posWord,
  ord,
} from "@/lib/nba";
import { bestPrice, propLeg } from "@/lib/parlay";

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

const pct = (x: number | null) => (x == null ? "-" : `${Math.round(x * 100)}%`);
const shortDate = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });

export function PropsTab() {
  const { state, addBet, applyOdds, addLeg, setActiveTab } = useNBA();
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

  const curLabel = `${state.season} season`;
  const prevLabel = `${prevSeasonLabel(state.season)} season`;

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

  return (
    <div>
      <h2>Player Props</h2>
      <p className="sub">
        Use The Odds API key to fetch live lines. Click a prop card to see exactly how often it has
        gone Over and Under. Use &ldquo;+ Parlay&rdquo; to build a parlay.
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
          const a = p._analysis;
          const c = CTX[pl.team];
          const gm = c ? SLATE[c.gid] : null;
          const isOpen = open === p.id;
          const w = windows(pl, state.seasonStart);
          const rows = [
            { label: "Last 10 games", r: record(w.l10, p.market, p.line) },
            { label: "Last 15 games", r: record(w.l15, p.market, p.line) },
            { label: curLabel, r: record(w.cur, p.market, p.line) },
            { label: prevLabel, r: record(w.prev, p.market, p.line) },
          ];
          const over = bestPrice(p.books, "over");
          const under = bestPrice(p.books, "under");
          const d = defExplain(a.rank, pl.pos, p.market);
          const oppName = c ? T[c.opp]?.name || c.opp : "the opponent";
          const addToParlay = (side: "over" | "under") => {
            addLeg(propLeg(p, pl, gm, side));
            setAdded(`Added ${pl.name} ${side} to your parlay`);
            setTimeout(() => setAdded(""), 2500);
          };

          return (
            <div
              key={p.id}
              className="card"
              style={{ cursor: "pointer", outline: isOpen ? "1px solid var(--blue)" : "none" }}
              onClick={() => setOpen(isOpen ? null : p.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <b>{pl.name}</b>{" "}
                  <span className="note">
                    ({pl.team}, {posWord(pl.pos).replace(/s$/, "")})
                  </span>
                  {gm && (
                    <span className="note"> vs {pl.team === gm.home ? gm.away : gm.home} tonight</span>
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
                <b>
                  {MS[p.market]}: Over/Under {p.line}
                </b>
                <span className="note"> {"\u2014"} {mktWord(p.market)} in this game</span>
              </div>

              <div className="text-sm" style={{ marginBottom: 6 }}>
                {a.best.ev >= 0.03 ? (
                  <>
                    Best play:{" "}
                    <b>
                      {a.best.side === "over" ? "Over" : "Under"} {a.best.line}
                    </b>{" "}
                    at {a.best.book} ({fmtO(a.best.odds)}). We give it a <b>{Math.round(a.best.p * 100)}%</b>{" "}
                    chance to hit, which beats the {Math.round((1 / decOdds(a.best.odds)) * 100)}% the odds
                    imply by <b>{(a.best.ev * 100).toFixed(1)}%</b> of the stake.
                  </>
                ) : (
                  <span style={{ color: "var(--mut)" }}>
                    No clear edge: the odds already match how often this tends to hit.
                  </span>
                )}
              </div>

              <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 2 }}>
                {curLabel} average: <b>{p.proj}</b> {MK[p.market]} per game
                {pl.min ? ` (${Math.round(pl.min)} min)` : ""}
              </div>
              <div className="text-xs" style={{ marginBottom: 6, color: "var(--mut)" }}>
                Opponent defense: <b className={d.tone}>{d.strength}</b> against {posWord(pl.pos)} for{" "}
                {mktWord(p.market)} ({ord(d.rank)} of 30, where 1st is the toughest). {oppName} {d.effect}.
              </div>
              <div className="text-xs" style={{ color: "var(--blue)" }}>
                {isOpen ? "Click to hide breakdown" : "Click for Over/Under breakdown"}
              </div>

              {isOpen && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, cursor: "default" }}>
                  <div className="text-sm" style={{ marginBottom: 4 }}>
                    <b>
                      How often {pl.name} went Over or Under {p.line} {mktWord(p.market)}
                    </b>
                  </div>
                  <table style={{ width: "100%", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Period</th>
                        <th>Games</th>
                        <th>Over</th>
                        <th>Under</th>
                        <th>Over %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((x) => (
                        <tr key={x.label}>
                          <td>{x.label}</td>
                          <td style={{ textAlign: "center" }}>{x.r.n}</td>
                          <td style={{ textAlign: "center" }} className="ok">
                            {x.r.o}
                          </td>
                          <td style={{ textAlign: "center" }} className="bad">
                            {x.r.u}
                            {x.r.push ? ` (${x.r.push} push)` : ""}
                          </td>
                          <td style={{ textAlign: "center" }}>{pct(x.r.pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-xs" style={{ color: "var(--mut)", margin: "4px 0 6px" }}>
                    &ldquo;Over&rdquo; means he finished above {p.line}; &ldquo;Under&rdquo; means below it. A game
                    exactly on {p.line} is a push.
                  </div>

                  <div className="text-xs" style={{ marginBottom: 2, color: "var(--mut)" }}>
                    Last 10 games (newest first):
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                    {w.l10.map((g, gi) => {
                      const v = (g as any)[p.market] as number;
                      const cls = v > p.line ? "ok" : v < p.line ? "bad" : "";
                      return (
                        <span
                          key={gi}
                          className="text-xs"
                          style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 4 }}
                          title={`${shortDate(g.date)} ${g.home ? "vs" : "@"} ${g.opp}`}
                        >
                          {shortDate(g.date)} {g.home ? "vs" : "@"} {g.opp}:{" "}
                          <b className={cls}>{v}</b> {v > p.line ? "Over" : v < p.line ? "Under" : "Push"}
                        </span>
                      );
                    })}
                  </div>

                  <div className="grid g2" style={{ gap: 6, marginBottom: 6 }}>
                    <div style={{ background: "var(--bg)", padding: 6, borderRadius: 4 }}>
                      <div className="text-sm">
                        <b>OVER {over.line}</b>
                      </div>
                      <div className="text-xs" style={{ color: "var(--mut)" }}>
                        Best price {fmtO(over.price)} at {over.book}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <button
                          className="b sm alt"
                          onClick={() =>
                            addBet(`${pl.name} Over ${over.line} ${MS[p.market]}`, over.book, over.price, 1)
                          }
                        >
                          +Bet Over
                        </button>
                        <button className="b sm alt" onClick={() => addToParlay("over")}>
                          + Parlay
                        </button>
                      </div>
                    </div>
                    <div style={{ background: "var(--bg)", padding: 6, borderRadius: 4 }}>
                      <div className="text-sm">
                        <b>UNDER {under.line}</b>
                      </div>
                      <div className="text-xs" style={{ color: "var(--mut)" }}>
                        Best price {fmtO(under.price)} at {under.book}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <button
                          className="b sm alt"
                          onClick={() =>
                            addBet(`${pl.name} Under ${under.line} ${MS[p.market]}`, under.book, under.price, 1)
                          }
                        >
                          +Bet Under
                        </button>
                        <button className="b sm alt" onClick={() => addToParlay("under")}>
                          + Parlay
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 2 }}>
                    Every sportsbook (Over / Under):
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
                            <a href={BOOK_URLS[b.book]} target="_blank" rel="noopener">
                              {b.book}
                            </a>
                          ) : (
                            b.book
                          )}
                        </span>
                        <span>
                          line {b.line}: O {fmtO(b.over)} / U {fmtO(b.under)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <button className="b sm" onClick={() => setActiveTab("parlay")}>
                      Open parlay builder
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
