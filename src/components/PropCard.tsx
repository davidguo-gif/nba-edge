"use client";

import { useEffect, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { BOOK_URLS, MARKET_NAMES, MARKET_LABELS, type PropBook, type Player, type SlateGame } from "@/types";
import { windows, record, defExplain, prevSeasonLabel, mktWord, posFull, posGroupLabel, ord, decOdds, type BetRating } from "@/lib/nba";
import { bestPrice, propLeg } from "@/lib/parlay";
import { fmtOdds } from "@/lib/odds";

const pct = (x: number | null) => (x == null ? "-" : `${Math.round(x * 100)}%`);

export function PropCardRow({
  p,
  pl,
  gm,
  a,
  open,
  onToggle,
}: {
  p: any;
  pl: Player;
  gm: SlateGame | null;
  a: any;
  open: boolean;
  onToggle: () => void;
}) {
  const { state, addBet, addLeg, oddsFormat, setPropDetail, setActiveTab } = useNBA();
  const fo = (o: number) => fmtOdds(o, oddsFormat);

  const c = state.CTX[pl.team];
  const opp: string = c ? c.opp : "";
  const oppName = opp ? state.T[opp]?.name || opp : "";
  const w = windows(pl, state.seasonStart);
  const h2h = opp ? pl.log.filter((g) => g.opp === opp) : [];
  const curLabel = state.season;
  const prevLabel = prevSeasonLabel(state.season);

  const over = bestPrice(p.books, "over");
  const under = bestPrice(p.books, "under");
  const r10 = record(w.l10, p.market, p.line);
  const rc = record(w.cur, p.market, p.line);
  const rPrev = record(w.prev, p.market, p.line);
  const rH2H = record(h2h, p.market, p.line);

  const edgeOk = a.best.ev >= 0.03;
  const edgePct = edgeOk ? `${(a.best.ev * 100).toFixed(1)}%` : "";
  const pickLabel = edgeOk
    ? `${a.best.side === "over" ? "O" : "U"} ${a.best.line}`
    : "—";
  const confTag =
    a.conf === "Strong" ? "tag ok" : a.conf === "Lean" ? "tag warn" : "tag";
  const confStyle = a.conf === "Pass" ? { background: "#1e293b", color: "#94a3b8" } : undefined;
  const d = defExplain(a.rank, pl.pos, p.market);
  const gLabel = gm ? `${pl.team === gm.home ? "vs" : "@"} ${pl.team === gm.home ? gm.away : gm.home}` : pl.team;

  const addToParlay = (side: "over" | "under") => {
    addLeg(propLeg(p, pl, gm, side));
  };

  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>
          <b>{pl.name}</b>
          <div className="text-xs note">{pl.team} · {posFull(pl.posRaw)} · <span className="tag" style={{fontSize:9,padding:'0 4px',background:'#1e293b',color:'#94a3b8',verticalAlign:'middle'}}>{posGroupLabel(pl.pos)}</span></div>
        </td>
        <td>
          {gLabel}
          {gm && <div className="text-xs note">{gm.time}</div>}
        </td>
        <td>{MARKET_NAMES[p.market] || p.market}</td>
        <td className="num">{p.line}</td>
        <td>
          {pickLabel}
          {edgePct && <div className="text-xs" style={{ color: "var(--green)" }}>{edgePct} edge</div>}
          {!edgePct && <div className="text-xs note">—</div>}
        </td>
        <td>
          L10 <b>{r10.o}/{r10.n}</b>
          <div className="text-xs note">szn {rc.o}/{rc.n}</div>
        </td>
        <td className="num">
          <span className={d.tone}>{ord(a.rank)}</span>
          <div className="text-xs note">{a.rank >= 21 ? "soft" : a.rank <= 10 ? "tough" : "avg"}</div>
        </td>
        <td>
          <span className={confTag} style={confStyle}>{a.conf}</span>
        </td>
        <td className="num">
          {a.rating && (
            <span className={`tag ${a.rating.grade === "A" || a.rating.grade === "B" ? "ok" : a.rating.grade === "D" || a.rating.grade === "F" ? "bad" : "warn"}`}>
              {a.rating.grade}
            </span>
          )}
          <div className="text-xs note">{a.rating ? a.rating.score : "—"}</div>
        </td>
      </tr>
      {open && (
        <tr className="expand-row">
          <td colSpan={9} style={{ padding: 0, borderBottom: "2px solid var(--blue)" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ padding: "12px 16px", cursor: "default", background: "rgba(59,130,246,0.04)" }}>
              {/* Analysis notes — clean, concise */}
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Analysis</h3>
              <ul className="clean text-sm" style={{ marginBottom: 8 }}>
                <li className="row">
                  <b>Edge:</b> {edgeOk
                    ? `+${(a.best.ev * 100).toFixed(1)}% — above 3% threshold, playable (sharp: ${a.consensus?.booksUsed?.filter((b:any) => b.name !== "avg").map((b:any) => b.name).join(", ") || "consensus"})`
                    : a.best.ev > 0
                      ? `+${(a.best.ev * 100).toFixed(1)}% — below 3% threshold (sharp: ${a.consensus?.booksUsed?.filter((b:any) => b.name !== "avg").map((b:any) => b.name).join(", ") || "consensus"})`
                      : "No edge found"}
                </li>
                <li className="row">
                  <b>Pick:</b> {edgeOk ? (
                    <><b>{a.best.side === "over" ? "OVER" : "UNDER"} {a.best.line}</b> @ {a.best.book} ({fo(a.best.odds)}) — {Math.round(a.best.p * 100)}% hit vs {(1 / decOdds(a.best.odds) * 100).toFixed(0)}% implied</>
                  ) : <span className="note">No edge: prices match true hit rate</span>}
                </li>
                <li className="row">
                  <b>Hit rate:</b> L10 <b>{r10.o}/{r10.n}</b> ({pct(r10.pct)}) · szn <b>{rc.o}/{rc.n}</b> ({pct(rc.pct)}) · prev szn <b>{rPrev.o}/{rPrev.n}</b> ({pct(rPrev.pct)})
                  {rH2H.n > 0 && <> · H2H <b>{rH2H.o}/{rH2H.n}</b> ({pct(rH2H.pct)})</>}
                </li>
                <li className="row">
                  <b>Defense:</b> {oppName || opp} ranks <b>{ord(a.rank)}</b> vs {posFull(pl.posRaw)} in {MARKET_NAMES[p.market]} — {d.effect}
                </li>
                {a.rating && (
                  <li className="row" style={{ marginTop: 6 }}>
                    <b>Rating:</b> <span className={`tag ${a.rating.grade === "A" || a.rating.grade === "B" ? "ok" : a.rating.grade === "D" || a.rating.grade === "F" ? "bad" : "warn"}`}>{a.rating.grade}</span> ({a.rating.score}/100)
                    <ul className="clean text-xs" style={{ marginTop: 2 }}>
                      {a.rating.factors.map((f: any, fi: number) => (
                        <li key={fi} className="row" style={{ fontSize: 11, color: f.impact === "positive" ? "var(--green)" : f.impact === "negative" ? "var(--red)" : "var(--mut)" }}>
                          <b>{f.name}:</b> {f.detail}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
                {p.proj != null && (
                  <li className="row">
                    <b>Avg:</b> {p.proj} {MARKET_LABELS[p.market]} per game
                  </li>
                )}
              </ul>

              {/* Best prices */}
              <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                <div style={{ background: "rgba(34,197,94,0.08)", padding: 8, borderRadius: 6, border: "1px solid rgba(34,197,94,0.2)" }}>
                  <div className="text-sm"><b>OVER {over.line}</b> {fo(over.price)} @ {over.book}</div>
                  <div className="flex gap-1 mt-1" style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button className="b sm alt" onClick={() => addBet(`${pl.name} Over ${over.line} ${MARKET_LABELS[p.market]}`, over.book, over.price, 1)}>+Bet</button>
                    <button className="b sm alt" onClick={() => addToParlay("over")}>+Parlay</button>
                  </div>
                </div>
                <div style={{ background: "rgba(239,68,68,0.08)", padding: 8, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div className="text-sm"><b>UNDER {under.line}</b> {fo(under.price)} @ {under.book}</div>
                  <div className="flex gap-1 mt-1" style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button className="b sm alt" onClick={() => addBet(`${pl.name} Under ${under.line} ${MARKET_LABELS[p.market]}`, under.book, under.price, 1)}>+Bet</button>
                    <button className="b sm alt" onClick={() => addToParlay("under")}>+Parlay</button>
                  </div>
                </div>
              </div>

              {/* Sharp book odds */}
              {a.consensus?.booksUsed && a.consensus.booksUsed.length > 0 && a.consensus.booksUsed[0].name !== "avg" && (
                <div style={{ marginBottom: 8 }}>
                  <div className="text-xs note" style={{ marginBottom: 4 }}>Sharp consensus odds (weighted {a.conf === "Pass" || a.conf === "Lean" ? "below playable edge" : `→ ${(a.best.ev * 100).toFixed(1)}% EV`}):</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {a.consensus.booksUsed.map((sb: any, sbi: number) => (
                      <span key={sbi} className="text-xs" style={{ background: "rgba(179,136,255,0.1)", border: "1px solid rgba(179,136,255,0.2)", padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>
                        <b>{sb.name}</b> {sb.line}: {sb.odds > 0 ? "+" + sb.odds : sb.odds} ({sb.weight}% weight, {(sb.prob * 100).toFixed(1)}% implied)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Book prices in a row */}
              <div className="text-xs note" style={{ marginBottom: 6 }}>All books (line: O / U):</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {p.books.map((b: PropBook, bi: number) => (
                  <span key={bi} className="text-xs" style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
                    {BOOK_URLS[b.book] ? <a href={BOOK_URLS[b.book]} target="_blank" rel="noopener">{b.book}</a> : b.book}
                    &nbsp;{b.line}: O {fo(b.over)} / U {fo(b.under)}
                  </span>
                ))}
              </div>

              {/* View full history */}
              <div style={{ display: "flex", gap: 6 }}>
                <button className="b sm" onClick={() => setPropDetail ? setPropDetail(p.id) : setActiveTab("parlay")}>
                  View full history (chart, slider, period analysis)
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}