"use client";

import { useState, useEffect, useMemo } from "react";
import { useNBA } from "@/lib/NBAContext";
import { MARKET_NAMES } from "@/types";
import type { PickRecord } from "@/types";
import { decOdds, todayET, etDate } from "@/lib/nba";
import { sideHits } from "@/lib/analysis";
import { fmtOdds } from "@/lib/odds";
import { PropCardRow } from "./PropCard";

const profitOf = (r: PickRecord) => (r.result === "win" ? decOdds(r.odds) - 1 : r.result === "loss" ? -1 : 0);

function summarize(rows: PickRecord[]) {
  const w = rows.filter((r) => r.result === "win").length;
  const l = rows.filter((r) => r.result === "loss").length;
  const push = rows.filter((r) => r.result === "push").length;
  const pending = rows.filter((r) => r.result === "pending").length;
  const net = rows.reduce((s, r) => s + profitOf(r), 0);
  const risked = w + l;
  return { w, l, push, pending, net, hit: risked ? w / risked : null, roi: risked ? net / risked : null };
}

function HistoryView({ date }: { date: string }) {
  const { history, bets, oddsFormat } = useNBA();
  const [tier, setTier] = useState<"all" | "lean" | "strong">("all");
  const rows = useMemo(
    () =>
      history
        .filter((r) => r.date === date && (tier === "all" || (tier === "lean" ? r.ev >= 0.03 : r.ev >= 0.08)))
        .sort((a, b) => b.ev - a.ev),
    [history, date, tier],
  );
  // your own straight bets from that day (tracker), graded the same way
  const dayBets = useMemo(
    () => bets.filter((b) => (b.pick?.date ?? etDate(b.date)) === date),
    [bets, date],
  );
  const betProfit = (b: (typeof bets)[number]) => (b.result === "win" ? b.units * (decOdds(b.odds) - 1) : b.result === "loss" ? -b.units : 0);
  const betNet = dayBets.reduce((s, b) => s + betProfit(b), 0);
  const day = summarize(rows);
  const all = summarize(history);
  const byGrade = ["A", "B", "C", "D", "F"].map((g) => ({ g, ...summarize(rows.filter((r) => r.grade === g)) })).filter((x) => x.w + x.l + x.push + x.pending > 0);
  const pct = (x: number | null) => (x == null ? "-" : `${Math.round(x * 100)}%`);

  return (
    <div>
      <div className="stats">
        <div className="stat"><span>Record</span><b>{day.w}-{day.l}{day.push ? `-${day.push}` : ""}</b></div>
        <div className="stat"><span>Hit rate</span><b>{pct(day.hit)}</b></div>
        <div className="stat"><span>Units (1u flat)</span><b className={day.net >= 0 ? "ok" : "bad"}>{day.net >= 0 ? "+" : ""}{day.net.toFixed(2)}u</b></div>
        <div className="stat"><span>ROI</span><b className={(day.roi ?? 0) >= 0 ? "ok" : "bad"}>{day.roi == null ? "-" : `${(day.roi * 100).toFixed(1)}%`}</b></div>
        <div className="stat"><span>Pending</span><b>{day.pending}</b></div>
        <div className="stat"><span>All saved days</span><b>{all.w}-{all.l}</b><small className={all.net >= 0 ? "ok" : "bad"}>{all.net >= 0 ? "+" : ""}{all.net.toFixed(2)}u</small></div>
      </div>

      <div className="filters">
        <select value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
          <option value="all">Every pick we made</option>
          <option value="lean">+EV 3% or more</option>
          <option value="strong">Strong +EV 8% or more</option>
        </select>
        <span className="note">{rows.length} pick{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {byGrade.length > 0 && (
        <div className="filters">
          <span className="note">By rating:</span>
          {byGrade.map((x) => (
            <span key={x.g} className="pill static">{x.g} · {x.w}-{x.l}{x.push ? `-${x.push}` : ""}</span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty">
          No picks were saved for this day. Every pick with a positive projected EV is saved automatically
          whenever you fetch odds before tip-off, so history starts building from the first fetch.
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Prop</th>
                <th>Pick</th>
                <th>Book</th>
                <th className="num">Edge</th>
                <th>Rating</th>
                <th className="num">Actual</th>
                <th>Result</th>
                <th className="num">Units</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td><b>{r.player}</b><div className="note">{r.team} vs {r.opp}</div></td>
                  <td>{MARKET_NAMES[r.market] || r.market}</td>
                  <td><b>{r.side === "over" ? "Over" : "Under"} {r.line}</b></td>
                  <td>{r.book} <span className="note">{fmtOdds(r.odds, oddsFormat)}</span></td>
                  <td className="num ok">+{(r.ev * 100).toFixed(1)}%</td>
                  <td><span className={`tag ${r.grade === "A" || r.grade === "B" ? "ok" : r.grade === "D" || r.grade === "F" ? "bad" : "warn"}`}>{r.grade}</span> <span className="note">{r.score}</span></td>
                  <td className="num">{r.actual ?? "-"}</td>
                  <td>
                    {r.result === "pending" ? <span className="tag">Awaiting stats</span> : <span className={`tag ${r.result === "win" ? "ok" : r.result === "loss" ? "bad" : "warn"}`}>{r.result === "win" ? "HIT" : r.result === "loss" ? "MISS" : "PUSH"}</span>}
                  </td>
                  <td className={`num ${profitOf(r) >= 0 ? "ok" : "bad"}`}>{r.result === "pending" ? "-" : `${profitOf(r) >= 0 ? "+" : ""}${profitOf(r).toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3>Your straight bets</h3>
      {dayBets.length === 0 ? (
        <div className="note">No bets tracked for this day. Bets you add with +Bet or in the Tracker are kept here by day.</div>
      ) : (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Bet</th><th>Book</th><th className="num">Odds</th><th className="num">Units</th><th className="num">Actual</th><th>Result</th><th className="num">P/L</th></tr>
              </thead>
              <tbody>
                {dayBets.map((b) => (
                  <tr key={String(b.id)}>
                    <td>{b.desc}</td>
                    <td>{b.book}</td>
                    <td className="num">{fmtOdds(b.odds, oddsFormat)}</td>
                    <td className="num">{b.units}</td>
                    <td className="num">{b.actual ?? "-"}</td>
                    <td>{b.result === "pending" ? <span className="tag">Pending</span> : <span className={`tag ${b.result === "win" ? "ok" : b.result === "loss" ? "bad" : "warn"}`}>{b.result === "win" ? "HIT" : b.result === "loss" ? "MISS" : "PUSH"}</span>}</td>
                    <td className={`num ${betProfit(b) >= 0 ? "ok" : "bad"}`}>{b.result === "pending" ? "-" : `${betProfit(b) >= 0 ? "+" : ""}${betProfit(b).toFixed(2)}u`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note">Net for your bets this day: <b className={betNet >= 0 ? "ok" : "bad"}>{betNet >= 0 ? "+" : ""}{betNet.toFixed(2)}u</b></div>
        </>
      )}
      {day.pending > 0 && (
        <p className="note">
          &ldquo;Awaiting stats&rdquo; picks are graded automatically as soon as the game appears in the NBA data. Run <code>update-data.bat</code> and reload to pull the latest box scores.
        </p>
      )}
    </div>
  );
}

export function PropsTab() {
  const { state, applyOdds, focus, clearFocus, selectedDate, setSelectedDate } = useNBA();
  const { SLATE, PROPS, PLAYERS } = state;
  const [apiKey, setApiKey] = useState("");
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [oddsStatus, setOddsStatus] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [leanFilter, setLeanFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [added, setAdded] = useState("");
  const [sortCol, setSortCol] = useState("edge");
  const [sortDir, setSortDir] = useState(-1);

  const isPast = selectedDate < todayET();
  const dayProps = PROPS.filter((p) => p.date === selectedDate && p._analysis);
  const dayGames = SLATE.filter((g) => g.date === selectedDate);
  // only the teams actually playing on the selected date
  const dayTeams = [...new Set(dayGames.flatMap((g) => [g.away, g.home]))].sort();

  const marketsToday = useMemo(() => {
    const seen = new Set(dayProps.map((p) => p.market));
    return Object.keys(MARKET_NAMES).filter((m) => seen.has(m));
  }, [dayProps.length, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const rawProps = dayProps.filter((p) => {
    const pl = PLAYERS[p.pid];
    const a = p._analysis!;
    if (!pl) return false;
    if (teamFilter !== "all" && pl.team !== teamFilter) return false;
    if (marketFilter !== "all" && p.market !== marketFilter) return false;
    if (searchQ && !pl.name.toLowerCase().includes(searchQ.toLowerCase())) return false;
    if (leanFilter === "strong" && a.conf !== "Strong") return false;
    if (leanFilter === "lean" && a.conf === "Pass") return false;
    if (leanFilter === "inj" && !a.injury.items.length) return false;
    return true;
  });

  const colSorter = (p: any): string | number => {
    const pl = PLAYERS[p.pid];
    if (!pl) return 0;
    const a = p._analysis;
    switch (sortCol) {
      case "player": return pl.name;
      case "game": return pl.team;
      case "market": return p.market;
      case "line": return p.line;
      case "edge": return a.source === "none" ? -9 : a.best.ev;
      case "win": return a.source === "none" ? 0 : a.best.p;
      case "avg": return p.proj ?? 0;
      case "proj": return a.proj ?? 0;
      case "l10": case "szn": case "h2h":
        return sideHits(pl, state, p, a)[sortCol].pct ?? -1;
      case "conf": return { Strong: 3, Lean: 2, Pass: 1 }[a.conf as "Strong"] ?? 0;
      case "def": return a.rank ?? 15;
      case "rating": return a.rating?.score ?? 0;
      default: return 0;
    }
  };
  const sorted = [...rawProps].sort((a, b) => {
    const va = colSorter(a), vb = colSorter(b);
    const d = typeof va === "string" ? String(va).localeCompare(String(vb)) : (va as number) - (vb as number);
    return d * sortDir || 0;
  });

  useEffect(() => {
    const stored = localStorage.getItem("nbaedge.apikey");
    if (stored) setApiKey(stored);
  }, []);

  // reset game filter when the day changes
  useEffect(() => { setTeamFilter("all"); setOpen(null); }, [selectedDate]);

  // focus from parlay leg
  useEffect(() => {
    if (!focus || focus.tab !== "props") return;
    const p = PROPS.find((x) => PLAYERS[x.pid]?.name === focus.player && x.market === focus.market);
    if (!p) { setAdded("That prop isn't loaded right now."); clearFocus(); return; }
    setSelectedDate(p.date);
    setTeamFilter("all"); setMarketFilter("all"); setLeanFilter("all"); setSearchQ("");
    setOpen(p.id);
    clearFocus();
    setTimeout(() => {
      document.getElementById(`prop-row-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // One Odds API call returns both the retail books (to bet at) and the sharp books (for +EV only).
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
      const data = await res.json();
      await applyOdds(data);
      const withSharp = data.props.filter((p: any) => p.sharp?.length).length;
      setOddsStatus(`Loaded ${data.props.length} props across ${data.games.length} games · ${withSharp} priced by sharp books`);
    } catch (e: any) {
      setOddsStatus("Error: " + e.message);
    } finally {
      setLoadingOdds(false);
    }
  };

  const toggleSort = (c: string) => {
    if (sortCol === c) setSortDir(-sortDir);
    else { setSortCol(c); setSortDir(c === "player" || c === "game" || c === "market" ? 1 : -1); }
  };
  const sc = (c: string) => (sortCol === c ? (sortDir > 0 ? " ▲" : " ▼") : "");

  const dayLabel = new Date(selectedDate + "T12:00:00Z").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>NBA Player Prop Bets</h2>
          <p className="sub">
            {dayLabel}{isPast ? " · results" : ""}. Bet at the regular sportsbooks; Pinnacle, Kalshi, Novig, Polymarket and ProphetX are only used to find +EV.
          </p>
        </div>
      </div>

      {!isPast && (
        <div className="panel">
          <div className="form">
            <label>
              The Odds API key
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="the-odds-api.com key (retail + sharp books)" />
            </label>
            <button className="b" onClick={fetchOdds} disabled={loadingOdds || !apiKey}>
              {loadingOdds ? "Loading..." : "Fetch odds"}
            </button>
            <button className="b alt sm" onClick={() => {
              localStorage.removeItem("nbaedge.apikey");
              localStorage.removeItem("nbaedge.sgokey");
              localStorage.removeItem("nbaedge.odds");
              window.location.reload();
            }}>Clear</button>
          </div>
          {oddsStatus && <div className="note">{oddsStatus}</div>}
        </div>
      )}

      {isPast ? (
        <HistoryView date={selectedDate} />
      ) : (
        <>
          <div className="pills">
            <button className={`pill${marketFilter === "all" ? " on" : ""}`} onClick={() => setMarketFilter("all")}>All</button>
            {marketsToday.map((m) => (
              <button key={m} className={`pill${marketFilter === m ? " on" : ""}`} onClick={() => setMarketFilter(m)}>
                {MARKET_NAMES[m]}
              </button>
            ))}
          </div>

          <div className="filters">
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">All teams playing</option>
              {dayTeams.map((t) => {
                const g = dayGames.find((x) => x.home === t || x.away === t)!;
                return <option key={t} value={t}>{t} ({g.home === t ? "vs " + g.away : "@ " + g.home})</option>;
              })}
            </select>
            <select value={leanFilter} onChange={(e) => setLeanFilter(e.target.value)}>
              <option value="all">All picks</option>
              <option value="strong">Strong +EV only</option>
              <option value="lean">+EV (Lean & Strong)</option>
              <option value="inj">Injury-affected</option>
            </select>
            <input placeholder="Search player..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} style={{ maxWidth: 200 }} />
            <span className="note">{sorted.length} props</span>
            {added && <span className="note ok">{added}</span>}
          </div>

          {dayProps.length === 0 ? (
            <div className="empty">
              No props loaded for this day. Enter your Odds API key and click Fetch odds{dayGames.length ? "" : " (the feed lists games starting in the next 48 hours)"}.
            </div>
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("player")}>Player{sc("player")}</th>
                    <th onClick={() => toggleSort("game")}>Game{sc("game")}</th>
                    <th onClick={() => toggleSort("market")}>Prop (line){sc("market")}</th>
                    <th onClick={() => toggleSort("line")}>Pick{sc("line")}</th>
                    <th onClick={() => toggleSort("avg")} className="num" title="Season average">Avg{sc("avg")}</th>
                    <th onClick={() => toggleSort("proj")} className="num" title="Market projection adjusted by our model">Proj{sc("proj")}</th>
                    <th onClick={() => toggleSort("edge")} className="num" title="Projected EV: sharp books blended with our model">Proj EV{sc("edge")}</th>
                    <th onClick={() => toggleSort("win")} className="num" title="Projected win rate from our model and the sharp books">Win %{sc("win")}</th>
                    <th onClick={() => toggleSort("rating")} className="num">Rating{sc("rating")}</th>
                    <th onClick={() => toggleSort("def")} className="num">Opp rank{sc("def")}</th>
                    <th onClick={() => toggleSort("l10")} className="hr">L10{sc("l10")}</th>
                    <th onClick={() => toggleSort("szn")} className="hr">Season{sc("szn")}</th>
                    <th onClick={() => toggleSort("h2h")} className="hr">H2H{sc("h2h")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const pl = PLAYERS[p.pid];
                    return (
                      <PropCardRow
                        key={p.id}
                        p={p}
                        pl={pl}
                        gm={SLATE[p.gid] || null}
                        a={p._analysis!}
                        open={open === p.id}
                        onToggle={() => setOpen(open === p.id ? null : p.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
