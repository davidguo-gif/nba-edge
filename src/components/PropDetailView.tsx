"use client";

import { useEffect, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { BOOK_URLS, type Player, type SlateGame, type PropBook, MARKET_NAMES, MARKET_LABELS } from "@/types";
import { windows, record, defExplain, prevSeasonLabel, mktWord, posFull, posGroupLabel, ord, decOdds } from "@/lib/nba";
import { bestPrice, bestPriceAtLine, propLeg } from "@/lib/parlay";
import { fmtOdds } from "@/lib/odds";

const pct = (x: number | null) => (x == null ? "-" : `${Math.round(x * 100)}%`);
const shortDate = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });

type GameRow = { date: string; opp: string; home: boolean; [k: string]: any };

function BarChart({ games, stat, line }: { games: GameRow[]; stat: string; line: number }) {
  if (!games.length) return <div className="text-xs note">No games in this period.</div>;
  const data = [...games].reverse();
  const vals = data.map((g) => g[stat] as number);
  const top = Math.max(...vals, line, 1) * 1.15;
  const W = 800, H = 280, padL = 32, padB = 28, padT = 18;
  const plotH = H - padB - padT;
  const slot = (W - padL - 8) / data.length;
  const bw = Math.min(38, slot * 0.7);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const many = data.length > 20;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f * 0.87));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={padL - 4} y={y(t) + 3} fontSize={10} fill="#6b7280" textAnchor="end">{t}</text>
        </g>
      ))}
      {data.map((g, i) => {
        const v = vals[i], x = padL + i * slot + (slot - bw) / 2;
        const color = v > line ? "#16a34a" : v < line ? "#dc2626" : "#9ca3af";
        return (
          <g key={i}>
            <title>{`${shortDate(g.date)} ${g.home ? "vs" : "@"} ${g.opp}: ${v}`}</title>
            <rect x={x} y={y(v)} width={bw} height={Math.max(1, y(0) - y(v))} fill={color} rx={2} />
            {!many && <text x={x + bw / 2} y={y(v) - 4} fontSize={11} fill="#111827" textAnchor="middle">{v}</text>}
            {!many && <text x={x + bw / 2} y={H - padB + 14} fontSize={10} fill="#6b7280" textAnchor="middle">{g.home ? "" : "@"}{g.opp}</text>}
            {!many && <text x={x + bw / 2} y={H - padB + 24} fontSize={9} fill="#9ca3af" textAnchor="middle">{shortDate(g.date)}</text>}
          </g>
        );
      })}
      <line x1={padL} x2={W} y1={y(line)} y2={y(line)} stroke="#d97706" strokeWidth={2} strokeDasharray="6 3" />
      <text x={W - 2} y={y(line) - 5} fontSize={11} fill="#d97706" textAnchor="end">Line {line}</text>
    </svg>
  );
}

export function PropDetailView() {
  const { state, propDetail, setPropDetail, oddsFormat, addBet, addLeg, setActiveTab } = useNBA();
  const { PROPS, PLAYERS, SLATE, T } = state;
  const fo = (o: number) => fmtOdds(o, oddsFormat);
  const [line, setLine] = useState<number>(0);
  const [win, setWin] = useState<string>("l10");
  const prop = propDetail != null ? PROPS[propDetail] : null;

  // Find the prop by tracking its index — fallback to scanning by id
  const p = prop;
  const pl: Player | undefined = p ? PLAYERS[p.pid] : undefined;
  const gm: SlateGame | null = p ? SLATE[p.gid] || null : null;
  const opp = p ? p.opp : "";
  const oppName = opp ? state.T[opp]?.name || opp : "";

  useEffect(() => {
    if (p) setLine(p.line);
  }, [p?.line]);

  if (!p || !pl) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <button className="b sm alt" onClick={() => setPropDetail(null)}>← Back to Props</button>
        <p className="note" style={{ marginTop: 12 }}>Prop not found.</p>
      </div>
    );
  }

  const w = windows(pl, state.seasonStart);
  const h2h = opp ? pl.log.filter((g: any) => g.opp === opp) : [];
  const curLabel = state.season;
  const prevLabel = prevSeasonLabel(state.season);
  const sets: { key: string; label: string; games: GameRow[] }[] = [
    { key: "l10", label: "Last 10", games: w.l10 as GameRow[] },
    { key: "l15", label: "Last 15", games: w.l15 as GameRow[] },
    { key: "cur", label: curLabel, games: w.cur as GameRow[] },
    { key: "prev", label: prevLabel, games: w.prev as GameRow[] },
    { key: "h2h", label: `vs ${opp||"opp"} (H2H)`, games: h2h as GameRow[] },
  ];
  const chosen = sets.find((s) => s.key === win)!;

  const r10 = record(w.l10, p.market, p.line);
  const rc = record(w.cur, p.market, p.line);
  const span = Math.max(4, Math.round(Math.max(p.proj ?? p.line, p.line) * 0.6));
  const min = Math.max(0, Math.floor(Math.min(p.proj ?? p.line, p.line) - span) + 0.5);
  const max = Math.ceil(Math.max(p.proj ?? p.line, p.line) + span) - 0.5;

  const over = bestPriceAtLine(p.books, "over", p.line);
  const under = bestPriceAtLine(p.books, "under", p.line);

  // Use the same analysis computed by PropsTab (L10/L15/szn weighted, defense-adjusted, best EV)
  const analysis = p._analysis;
  const useEdge = analysis && !analysis.noSharp ? analysis.best.ev : 0;
  const useConf = analysis?.conf ?? "Pass";
  const useRank = analysis?.rank ?? (opp ? T[opp]?.rank?.[pl.pos]?.[p.market] || 15 : 15);
  const useBest = analysis && !analysis.noSharp ? analysis.best : undefined;
  const edgeOk = useEdge >= 0.03;

  // Compute the simpler edge too for display when analysis isn't available
  const seaHit = rc.n ? rc.o / rc.n : 0;
  const seaImp = over.price ? 1 / decOdds(over.price) : 0.5;
  const simpleEdge = seaHit - seaImp;

  // Use the analysis edge if available, otherwise fall back to simple
  const edge = useBest ? useEdge : simpleEdge;

  const d = defExplain(useRank, pl.pos, p.market);
  const actualRank = useRank;

  const rows = [
    { label: "Last 10", r: record(w.l10, p.market, line), games: w.l10 as GameRow[], key: "l10" },
    { label: "Last 15", r: record(w.l15, p.market, line), games: w.l15 as GameRow[], key: "l15" },
    { label: curLabel, r: record(w.cur, p.market, line), games: w.cur as GameRow[], key: "cur" },
    { label: prevLabel, r: record(w.prev, p.market, line), games: w.prev as GameRow[], key: "prev" },
    { label: `H2H vs ${opp}`, r: record(h2h, p.market, line), games: h2h as GameRow[], key: "h2h" },
  ];

  const gLabel = gm ? `${pl.team === gm.home ? "vs" : "@"} ${pl.team === gm.home ? gm.away : gm.home}` : pl.team;

  const addToParlay = (side: "over" | "under") => {
    addLeg(propLeg(p, pl, gm, side));
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <button className="b sm alt" onClick={() => setPropDetail(null)} style={{ marginBottom: 12 }}>
        ← Back to Props
      </button>

      {/* Hero */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>{pl.name} · {p.line} {MARKET_NAMES[p.market]}</h2>
            <div className="text-sm note">
              {pl.team} · {posFull(pl.posRaw)} · {posGroupLabel(pl.pos)} · {gLabel} {gm ? `· ${gm.time}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={`tag ${useConf === "Strong" ? "ok" : useConf === "Lean" ? "warn" : ""}`}>
              {useConf}
            </div>
          </div>
        </div>

        {/* Projection / Hit rates summary */}
        <div className="grid g2" style={{ marginBottom: 8, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className="text-xs note">Season avg</div>
            <div className="text-lg" style={{ fontWeight: 600 }}>
              {p.proj != null ? `${p.proj} ${MARKET_NAMES[p.market]}` : "—"}
            </div>
            <div className="text-xs note">L10: {r10.o}/{r10.n} ({pct(r10.pct)}) · Szn: {rc.o}/{rc.n} ({pct(rc.pct)})</div>
          </div>
          <div>
            <div className="text-xs note">Defense vs {posFull(pl.posRaw)} (Rank)</div>
            <div className="text-lg" style={{ fontWeight: 600 }}>
              <span className={actualRank >= 21 ? "bad" : actualRank <= 10 ? "ok" : ""}>
                {ord(actualRank)}
              </span>
            </div>
            <div className="text-xs note">{opp || ""} {actualRank >= 21 ? "allows more" : actualRank <= 10 ? "limits" : "is avg"} vs this position</div>
          </div>
        </div>

        {/* Best prices */}
        <div className="grid g2" style={{ gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          <div className="side over">
            <div className="text-sm"><b>OVER {over.line}</b></div>
            <div className="text-xs">{fo(over.price)} @ {over.book}</div>
            <div className="flex gap-1 mt-1" style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button className="b sm" onClick={() => addBet(`${pl.name} Over ${over.line} ${MARKET_LABELS[p.market]}`, over.book, over.price, 1, undefined, { player: pl.name, market: p.market, line: over.line, side: "over", date: p.date })}>+ Bet</button>
              <button className="b sm alt" onClick={() => addToParlay("over")}>+ Parlay</button>
            </div>
          </div>
          <div className="side under">
            <div className="text-sm"><b>UNDER {under.line}</b></div>
            <div className="text-xs">{fo(under.price)} @ {under.book}</div>
            <div className="flex gap-1 mt-1" style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button className="b sm" onClick={() => addBet(`${pl.name} Under ${under.line} ${MARKET_LABELS[p.market]}`, under.book, under.price, 1, undefined, { player: pl.name, market: p.market, line: under.line, side: "under", date: p.date })}>+ Bet</button>
              <button className="b sm alt" onClick={() => addToParlay("under")}>+ Parlay</button>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis notes */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Analysis</h3>
        <ul className="clean text-sm">
          <li className="row">
            <b>Edge:</b> {useBest ? (
              <>{edge > 0.03
                ? `+${(edge * 100).toFixed(1)}% — above 3% threshold, playable`
                : edge > 0
                  ? `+${(edge * 100).toFixed(1)}% — below 3% threshold`
                  : "No edge found"} (sharp: {analysis!.consensus.booksUsed.map((b) => b.name).join(", ")})</>
            ) : (
              <>No sharp book has priced this exact line, so +EV can't be measured.</>
            )}
          </li>
          {useBest && (
            <li className="row">
              <b>Pick:</b> <b>{useBest.side === "over" ? "OVER" : "UNDER"} {useBest.line}</b> @ {useBest.book} ({fo(useBest.odds)}) — {Math.round(useBest.p * 100)}% hit vs {(1 / decOdds(useBest.odds) * 100).toFixed(0)}% implied
            </li>
          )}
          <li className="row">
            <b>Hit rate:</b> L10 <b>{r10.o}/{r10.n}</b> ({pct(r10.pct)}) · szn <b>{rc.o}/{rc.n}</b> ({pct(rc.pct)}) · implied {pct(seaImp)}
          </li>
          <li className="row">
            <b>Defense matchup:</b> {oppName || opp} ranks <b>{ord(actualRank)}</b> vs {posFull(pl.posRaw)} in {MARKET_NAMES[p.market]} —
            {actualRank >= 21 ? " weak defense, favors Over" : actualRank <= 10 ? " strong defense, favors Under" : " average defense, no strong lean"}
          </li>
          <li className="row">
            <b>Recent trend:</b> L10 {r10.o}/{r10.n} ({pct(r10.pct)})
            {r10.pct != null && rc.pct != null
              ? r10.pct > rc.pct
                ? " — heating up"
                : r10.pct < rc.pct
                  ? " — cooling off"
                  : " — steady"
              : ""}
          </li>
          {h2h.length > 0 && (() => {
            const h2hR = record(h2h, p.market, p.line);
            return (
              <li className="row">
                <b>H2H vs {oppName}:</b> {h2hR.o}/{h2hR.n} ({pct(h2hR.pct)}) in {h2h.length} games
              </li>
            );
          })()}
          {analysis && analysis.injury.items.map((it, ii) => (
            <li key={`inj${ii}`} className="row" style={{ color: it.side === "self" ? "var(--red)" : it.shift > 0 ? "var(--green)" : undefined }}>
              <b>Injury:</b> {it.detail}{it.shift !== 0 && <span className="note"> ({it.shift > 0 ? "favors Over" : "favors Under"})</span>}
            </li>
          ))}
          {gm && (gm.hRest === 0 || gm.aRest === 0) && (
            <li className="row">
              <b>Rest:</b> {pl.team === gm.home ? "Home" : "Away"} on {pl.team === gm.home ? gm.hRest : gm.aRest} days rest
              {gm.hRest === 0 && gm.aRest === 0 ? " (both B2B)" : gm.hRest === 0 || gm.aRest === 0 ? " (one B2B)" : ""}
            </li>
          )}
        </ul>
      </div>

      {/* Bar chart */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="text-sm" style={{ marginBottom: 4 }}>
          <b>{MARKET_LABELS[p.market]} per game — {chosen.label}</b>
          <span className="note"> (green = Over {line}, red = Under, dashed = line; tap period below to switch)</span>
        </div>
        <BarChart games={chosen.games} stat={p.market} line={line} />

        {/* Slider */}
        <div style={{ marginTop: 10 }}>
          <div className="text-xs note" style={{ marginBottom: 2 }}>
            Test line: <b>{line}</b> {mktWord(p.market)}
            {line !== p.line && <span> (book: {p.line}) <a style={{ cursor: "pointer" }} onClick={() => setLine(p.line)}>reset</a></span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="b sm alt" onClick={() => setLine(Math.max(0, +(line - 0.5).toFixed(1)))}>−0.5</button>
            <input type="range" min={min} max={max} step={0.5} value={line} onChange={(e) => setLine(+e.target.value)} style={{ flex: 1 }} />
            <button className="b sm alt" onClick={() => setLine(+(line + 0.5).toFixed(1))}>+0.5</button>
          </div>
        </div>
      </div>

      {/* History table + books */}
      <div className="card">
        <div className="grid g2" style={{ gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>History</h3>
            <table className="mini">
              <thead>
                <tr>
                  <th>Period (tap to graph)</th><th>G</th><th>O</th><th>U</th><th>O%</th><th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const avg = s.r.n ? s.games.reduce((t, g: any) => t + g[p.market], 0) / s.r.n : null;
                  return (
                    <tr key={s.key} onClick={() => setWin(s.key)}
                      style={{ cursor: "pointer", background: win === s.key ? "var(--blue-soft)" : "transparent" }}>
                      <td>{s.label}</td>
                      <td>{s.r.n}</td><td className="ok">{s.r.o}</td>
                      <td className="bad">{s.r.u}{s.r.push ? `+${s.r.push}p` : ""}</td>
                      <td>{pct(s.r.pct)}</td><td>{avg != null ? avg.toFixed(1) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            {analysis && analysis.consensus.booksUsed.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <h3 style={{ marginTop: 0, marginBottom: 4 }}>Sharp books (+EV only)</h3>
                {analysis.consensus.booksUsed.map((sb, sbi) => (
                  <div key={sbi} className="text-xs chip-book sharp" style={{ marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
                    <span><b>{sb.name}</b> ({(sb.weight).toFixed(1)}% weight)</span>
                    <span>{sb.line}: {sb.odds > 0 ? "+" + sb.odds : sb.odds} · {(sb.prob * 100).toFixed(1)}% implied</span>
                  </div>
                ))}
              </div>
            )}
            <h3 style={{ marginTop: 0 }}>Sportsbooks (to bet)</h3>
            {p.books.map((b: PropBook, bi: number) => (
              <div key={bi} className="text-xs" style={{ background: "var(--bg)", padding: "3px 6px", borderRadius: 4, marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
                <span>{BOOK_URLS[b.book] ? <a href={BOOK_URLS[b.book]} target="_blank" rel="noopener">{b.book}</a> : b.book}</span>
                <span>{b.line}: O {fo(b.over)} / U {fo(b.under)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs note" style={{ marginTop: 6 }}>
          &ldquo;Over&rdquo; = above {line}; &ldquo;Under&rdquo; = below; exactly {line} = push (p)
        </div>
      </div>
    </div>
  );
}