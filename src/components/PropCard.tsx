"use client";

import { useNBA } from "@/lib/NBAContext";
import { BOOK_URLS, MARKET_NAMES, MARKET_LABELS, type PropBook, type Player, type SlateGame, type PropAnalysis } from "@/types";
import { windows, record, defExplain, prevSeasonLabel, posFull, posGroupLabel, ord, decOdds } from "@/lib/nba";
import { bestPriceAtLine, propLeg } from "@/lib/parlay";
import { sideHits, type SideHit } from "@/lib/analysis";
import { fmtOdds } from "@/lib/odds";

const pct = (x: number | null) => (x == null ? "-" : `${Math.round(x * 100)}%`);
function Hit({ h }: { h: SideHit }) {
  if (!h.n) return <td className="hr"><span className="note">-</span></td>;
  const cls = h.pct! >= 0.6 ? "good" : h.pct! <= 0.4 ? "bad" : "mid";
  return (
    <td className="hr">
      <span className={`hr-chip ${cls}`}>{Math.round(h.pct! * 100)}%</span>
      <div className="note">{h.hit}/{h.n}</div>
    </td>
  );
}
const gradeCls = (g: string) => (g === "A" || g === "B" ? "ok" : g === "D" || g === "F" ? "bad" : "warn");

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
  a: PropAnalysis;
  open: boolean;
  onToggle: () => void;
}) {
  const { state, addBet, addLeg, oddsFormat, setPropDetail } = useNBA();
  const fo = (o: number) => fmtOdds(o, oddsFormat);

  const opp: string = p.opp;
  const oppName = opp ? state.T[opp]?.name || opp : "";
  const w = windows(pl, state.seasonStart);
  const h2h = opp ? pl.log.filter((g) => g.opp === opp) : [];
  const prevLabel = prevSeasonLabel(state.season);

  const over = bestPriceAtLine(p.books, "over", p.line);
  const under = bestPriceAtLine(p.books, "under", p.line);
  const r10 = record(w.l10, p.market, p.line);
  const rc = record(w.cur, p.market, p.line);
  const rPrev = record(w.prev, p.market, p.line);
  const rH2H = record(h2h, p.market, p.line);

  const edgeOk = !a.noSharp && a.best.ev >= 0.03;
  const pickLabel = edgeOk ? `${a.best.side === "over" ? "O" : "U"} ${a.best.line}` : "—";
  const confCls = a.conf === "Strong" ? "tag ok" : a.conf === "Lean" ? "tag warn" : "tag";
  const d = defExplain(a.rank, pl.pos, p.market);
  const gLabel = gm ? `${pl.team === gm.home ? "vs" : "@"} ${pl.team === gm.home ? gm.away : gm.home}` : pl.team;
  const sharpNames = a.consensus.booksUsed.map((b) => b.name).join(", ");
  const inj = a.injury;
  const injFlag = inj.self === "out" ? "OUT" : inj.self === "risk" ? "RISK" : inj.items.some((i) => i.shift !== 0) ? "INJ" : "";

  const hits = sideHits(pl, state, p, a);
  const diff = p.proj != null && p.proj > 0 ? p.proj - p.line : null;

  const pick = (side: "over" | "under") => ({ player: pl.name, market: p.market, line: side === "over" ? over.line : under.line, side, date: p.date });

  return (
    <>
      <tr id={`prop-row-${p.id}`} onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>
          <b>{pl.name}</b>
          {injFlag && <span className={`tag ${inj.self === "out" ? "bad" : "warn"}`} style={{ marginLeft: 6 }} title="Injury report affects this prop">{injFlag}</span>}
          <div className="note">{pl.team} · {posFull(pl.posRaw)} · {posGroupLabel(pl.pos)}</div>
        </td>
        <td>
          {gLabel}
          {gm && <div className="note">{gm.time}</div>}
        </td>
        <td>{MARKET_NAMES[p.market] || p.market}</td>
        <td>
          {edgeOk ? (
            <>
              <span className={`pickbtn ${a.best.side}`}>{a.best.side === "over" ? "O" : "U"} {a.best.line}</span>
              <div className="note">{fo(a.best.odds)} · {a.best.book}</div>
            </>
          ) : (
            <>
              <span className="note">{a.noSharp ? "No sharp line" : "No edge"}</span>
              <div className="note">line {p.line}</div>
            </>
          )}
        </td>
        <td className="num">
          {p.proj != null && p.proj > 0 ? <b>{p.proj}</b> : <span className="note">-</span>}
          {diff != null && <div className={`note ${diff > 0 ? "ok" : diff < 0 ? "bad" : ""}`}>{diff > 0 ? "+" : ""}{diff.toFixed(1)} vs line</div>}
        </td>
        <td className="num">
          {edgeOk ? <b className="ok">+{(a.best.ev * 100).toFixed(1)}%</b> : <span className="note">-</span>}
          <div><span className={confCls}>{a.conf}</span></div>
        </td>
        <td className="num">
          <span className={`tag ${gradeCls(a.rating.grade)}`}>{a.rating.grade}</span>
          <div className="note">{a.rating.score}</div>
        </td>
        <td className="num">
          <span className={d.tone}>{ord(a.rank)}</span>
          <div className="note">{a.rank >= 21 ? "soft" : a.rank <= 10 ? "tough" : "avg"}</div>
        </td>
        <Hit h={hits.l5} />
        <Hit h={hits.l10} />
        <Hit h={hits.l15} />
        <Hit h={hits.szn} />
        <Hit h={hits.h2h} />
      </tr>
      {open && (
        <tr className="expand-row">
          <td colSpan={13} style={{ padding: 0 }}>
            <div className="expand" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Analysis</h3>
              <ul className="clean text-sm" style={{ marginBottom: 8 }}>
                <li className="row">
                  <b>Edge:</b>{" "}
                  {a.noSharp
                    ? "No sharp book (Pinnacle, Kalshi, Novig, Polymarket, ProphetX) has priced this exact line, so +EV can't be measured. Treat it as unrated."
                    : a.best.ev >= 0.03
                      ? `+${(a.best.ev * 100).toFixed(1)}% — playable (sharp: ${sharpNames})`
                      : a.best.ev > 0
                        ? `+${(a.best.ev * 100).toFixed(1)}% — below the 3% threshold (sharp: ${sharpNames})`
                        : `No positive EV at any book (sharp: ${sharpNames})`}
                </li>
                {!a.noSharp && (
                  <li className="row">
                    <b>Best bet:</b> <b>{a.best.side === "over" ? "OVER" : "UNDER"} {a.best.line}</b> @ {a.best.book} ({fo(a.best.odds)}) — sharp true probability {Math.round(a.best.p * 100)}% vs {(100 / decOdds(a.best.odds)).toFixed(0)}% implied by the price
                  </li>
                )}
                <li className="row">
                  <b>Hit rate:</b> L10 <b>{r10.o}/{r10.n}</b> ({pct(r10.pct)}) · szn <b>{rc.o}/{rc.n}</b> ({pct(rc.pct)}) · {prevLabel} <b>{rPrev.o}/{rPrev.n}</b> ({pct(rPrev.pct)})
                  {rH2H.n > 0 && <> · H2H <b>{rH2H.o}/{rH2H.n}</b> ({pct(rH2H.pct)})</>}
                </li>
                <li className="row">
                  <b>Defense:</b> {oppName || opp} ranks <b>{ord(a.rank)}</b> vs {posFull(pl.posRaw)} in {MARKET_NAMES[p.market]} — {d.effect}
                </li>
                <li className="row" style={{ marginTop: 6 }}>
                  <b>Rating:</b> <span className={`tag ${gradeCls(a.rating.grade)}`}>{a.rating.grade}</span> ({a.rating.score}/100) for the {a.best.side === "over" ? "Over" : "Under"}
                  <ul className="clean text-xs" style={{ marginTop: 2 }}>
                    {a.rating.factors.map((f, fi) => (
                      <li key={fi} className="row" style={{ fontSize: 11, color: f.impact === "positive" ? "var(--green)" : f.impact === "negative" ? "var(--red)" : "var(--mut)" }}>
                        <b>{f.name}:</b> {f.detail}
                      </li>
                    ))}
                  </ul>
                </li>
                {p.proj != null && (
                  <li className="row">
                    <b>Avg:</b> {p.proj} {MARKET_LABELS[p.market]} per game
                  </li>
                )}
              </ul>

              {/* Injury impact on this prop */}
              <div className="inj-box">
                <b>Injury report for this prop</b>
                {inj.items.length === 0 ? (
                  <div className="note">No rotation injuries on {pl.team} or {opp} change this angle.</div>
                ) : (
                  <ul className="clean text-xs" style={{ marginTop: 4 }}>
                    {inj.items.map((it, i) => (
                      <li key={i} className="row" style={{ color: it.side === "self" ? "var(--red)" : it.shift > 0 ? "var(--green)" : "var(--text2)" }}>
                        <span>
                          <b>{it.side === "self" ? "This player" : it.side === "team" ? pl.team : opp}:</b> {it.detail}
                          {it.shift !== 0 && <span className="note"> ({it.shift > 0 ? "favors Over" : "favors Under"})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Bet at the retail books */}
              <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0" }}>
                <div className="side over">
                  <div className="text-sm"><b>OVER {over.line}</b> {fo(over.price)} @ {over.book}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button className="b sm alt" onClick={() => addBet(`${pl.name} Over ${over.line} ${MARKET_LABELS[p.market]}`, over.book, over.price, 1, undefined, pick("over"))}>+Bet</button>
                    <button className="b sm alt" onClick={() => addLeg(propLeg(p, pl, gm, "over"))}>+Parlay</button>
                  </div>
                </div>
                <div className="side under">
                  <div className="text-sm"><b>UNDER {under.line}</b> {fo(under.price)} @ {under.book}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button className="b sm alt" onClick={() => addBet(`${pl.name} Under ${under.line} ${MARKET_LABELS[p.market]}`, under.book, under.price, 1, undefined, pick("under"))}>+Bet</button>
                    <button className="b sm alt" onClick={() => addLeg(propLeg(p, pl, gm, "under"))}>+Parlay</button>
                  </div>
                </div>
              </div>

              {/* Sharp books: +EV spotting only */}
              {a.consensus.booksUsed.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div className="note" style={{ marginBottom: 4 }}>Sharp books (+EV spotting only, not for betting) · {a.best.side} {a.best.line}:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {a.consensus.booksUsed.map((sb, i) => (
                      <span key={i} className="chip-book sharp">
                        <b>{sb.name}</b> {fo(sb.odds)} · {(sb.prob * 100).toFixed(1)}% de-vigged · {sb.weight.toFixed(0)}% weight
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="note" style={{ marginBottom: 6 }}>Sportsbooks you can bet at (line: O / U):</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                {p.books.map((b: PropBook, bi: number) => (
                  <span key={bi} className="chip-book">
                    {BOOK_URLS[b.book] ? <a href={BOOK_URLS[b.book]} target="_blank" rel="noopener">{b.book}</a> : b.book}
                    &nbsp;{b.line}: O {fo(b.over)} / U {fo(b.under)}
                  </span>
                ))}
              </div>

              <button className="b sm" onClick={() => setPropDetail(p.id)}>
                View full history (chart, slider, period analysis)
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
