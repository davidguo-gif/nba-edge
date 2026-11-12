"use client";

import { useEffect, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { BOOK_URLS, type PropBook, type Player, type SlateGame, MARKET_NAMES, MARKET_LABELS } from "@/types";
import { windows, record, defExplain, prevSeasonLabel, mktWord, posFull, ord, decOdds } from "@/lib/nba";
import { bestPrice, propLeg } from "@/lib/parlay";
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
  const W = 640, H = 200, padL = 30, padB = 24, padT = 14;
  const plotH = H - padB - padT;
  const slot = (W - padL - 6) / data.length;
  const bw = Math.min(34, slot * 0.7);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const many = data.length > 20;
  const ticks = [0, 0.5, 1].map((f) => Math.round(top * f * 0.87));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#334155" strokeWidth={0.5} />
          <text x={padL - 4} y={y(t) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">{t}</text>
        </g>
      ))}
      {data.map((g, i) => {
        const v = vals[i], x = padL + i * slot + (slot - bw) / 2;
        const color = v > line ? "#4ade80" : v < line ? "#f87171" : "#94a3b8";
        return (
          <g key={i}>
            <title>{`${shortDate(g.date)} ${g.home ? "vs" : "@"} ${g.opp}: ${v}`}</title>
            <rect x={x} y={y(v)} width={bw} height={Math.max(1, y(0) - y(v))} fill={color} rx={2} />
            {!many && <text x={x + bw / 2} y={y(v) - 3} fontSize={10} fill="#e2e8f0" textAnchor="middle">{v}</text>}
            {!many && <text x={x + bw / 2} y={H - padB + 11} fontSize={9} fill="#94a3b8" textAnchor="middle">{g.home ? "" : "@"}{g.opp}</text>}
            {!many && <text x={x + bw / 2} y={H - padB + 21} fontSize={8} fill="#64748b" textAnchor="middle">{shortDate(g.date)}</text>}
          </g>
        );
      })}
      <line x1={padL} x2={W} y1={y(line)} y2={y(line)} stroke="#fcd34d" strokeWidth={1.5} strokeDasharray="5 3" />
      <text x={W - 2} y={y(line) - 4} fontSize={10} fill="#fcd34d" textAnchor="end">Line {line}</text>
    </svg>
  );
}

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
  const { state, addBet, addLeg, setActiveTab, oddsFormat } = useNBA();
  const { CTX } = state;
  const fo = (o: number) => fmtOdds(o, oddsFormat);
  const [line, setLine] = useState<number>(p.line);
  const [win, setWin] = useState<string>("l10");
  useEffect(() => setLine(p.line), [p.line]);

  const c = CTX[pl.team];
  const opp: string = c ? c.opp : "";
  const oppName = opp ? state.T[opp]?.name || opp : "";
  const w = windows(pl, state.seasonStart);
  const h2h = opp ? pl.log.filter((g) => g.opp === opp) : [];
  const curLabel = state.season;
  const prevLabel = prevSeasonLabel(state.season);
  const sets: { key: string; label: string; games: GameRow[] }[] = [
    { key: "l10", label: "Last 10", games: w.l10 },
    { key: "l15", label: "Last 15", games: w.l15 },
    { key: "cur", label: curLabel, games: w.cur },
    { key: "prev", label: prevLabel, games: w.prev },
    { key: "h2h", label: `vs ${opp || "opp"} (H2H)`, games: h2h },
  ];
  const chosen = sets.find((s) => s.key === win)!;

  const over = bestPrice(p.books, "over");
  const under = bestPrice(p.books, "under");
  const r10 = record(w.l10, p.market, p.line);
  const rc = record(w.cur, p.market, p.line);
  const span = Math.max(4, Math.round(Math.max(p.proj ?? p.line, p.line) * 0.6));
  const min = Math.max(0, Math.floor(Math.min(p.proj ?? p.line, p.line) - span) + 0.5);
  const max = Math.ceil(Math.max(p.proj ?? p.line, p.line) + span) - 0.5;

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

  const rows = [
    { label: "Last 10", r: record(w.l10, p.market, line), games: w.l10, key: "l10" },
    { label: "Last 15", r: record(w.l15, p.market, line), games: w.l15, key: "l15" },
    { label: curLabel, r: record(w.cur, p.market, line), games: w.cur, key: "cur" },
    { label: prevLabel, r: record(w.prev, p.market, line), games: w.prev, key: "prev" },
    { label: `H2H vs ${opp}`, r: record(h2h, p.market, line), games: h2h, key: "h2h" },
  ];

  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>
          <b>{pl.name}</b>
          <div className="text-xs note">{pl.team} · {posFull(pl.posRaw)}</div>
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
          <span className={d.tone}>{ord(d.rank)}</span>
          <div className="text-xs note">{a.rank >= 21 ? "soft" : a.rank <= 10 ? "tough" : "avg"}</div>
        </td>
        <td>
          <span className={confTag} style={confStyle}>{a.conf}</span>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} style={{ padding: 0, borderBottom: "2px solid var(--blue)" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ padding: "12px 16px", cursor: "default", background: "rgba(59,130,246,0.04)" }}>
              <div className="text-sm" style={{ marginBottom: 4 }}>
                <b>{MARKET_LABELS[p.market] || p.market}: </b>
                {edgeOk ? (
                  <span>Pick <b>{a.best.side === "over" ? "OVER" : "UNDER"} {a.best.line}</b> @ {a.best.book}
                    ({fo(a.best.odds)}) | {Math.round(a.best.p * 100)}% hit vs {(1 / decOdds(a.best.odds) * 100).toFixed(0)}% implied
                  </span>
                ) : (
                  <span className="note">No edge: prices match true hit rate</span>
                )}
                {p.proj != null && <span className="note"> | Avg {p.proj} {MARKET_NAMES[p.market]}</span>}
              </div>

              <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 6 }}>
                <div style={{ background: "var(--bg)", padding: 8, borderRadius: 4 }}>
                  <div className="text-sm"><b>OVER {over.line}</b> {fo(over.price)} @ {over.book}</div>
                  <div className="flex gap-1 mt-1">
                    <button className="b sm alt" onClick={() => addBet(`${pl.name} Over ${over.line} ${MARKET_LABELS[p.market]}`, over.book, over.price, 1)}>+Bet</button>
                    <button className="b sm alt" onClick={() => addToParlay("over")}>+Parlay</button>
                  </div>
                </div>
                <div style={{ background: "var(--bg)", padding: 8, borderRadius: 4 }}>
                  <div className="text-sm"><b>UNDER {under.line}</b> {fo(under.price)} @ {under.book}</div>
                  <div className="flex gap-1 mt-1">
                    <button className="b sm alt" onClick={() => addBet(`${pl.name} Under ${under.line} ${MARKET_LABELS[p.market]}`, under.book, under.price, 1)}>+Bet</button>
                    <button className="b sm alt" onClick={() => addToParlay("under")}>+Parlay</button>
                  </div>
                </div>
              </div>

              {/* slider */}
              <div style={{ marginBottom: 6 }}>
                <div className="text-xs note" style={{ marginBottom: 2 }}>
                  Test line: <b>{line}</b> {mktWord(p.market)}
                  {line !== p.line && <span> (book: {p.line}) <a style={{ cursor: "pointer" }} onClick={() => setLine(p.line)}>reset</a></span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button className="b sm alt" onClick={() => setLine(Math.max(0, +(line - 0.5).toFixed(1)))}>−0.5</button>
                  <input type="range" min={min} max={max} step={0.5} value={line} onChange={(e) => setLine(+e.target.value)} style={{ flex: 1 }} />
                  <button className="b sm alt" onClick={() => setLine(+(line + 0.5).toFixed(1))}>+0.5</button>
                </div>
                <div className="text-xs note">Slider only changes the history. Prices are for the book line ({p.line}).</div>
              </div>

              {/* bar chart */}
              <div className="text-xs" style={{ marginBottom: 2 }}>
                <b>{MARKET_LABELS[p.market]} per game — {chosen.label}</b>
                <span className="note"> (green = Over {line}, red = Under, dashed = line; tap period below to switch)</span>
              </div>
              <BarChart games={chosen.games as GameRow[]} stat={p.market} line={line} />

              {/* period chooser + books */}
              <div className="grid g2" style={{ gridTemplateColumns: "2fr 1fr", gap: 8, marginTop: 6 }}>
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
                          style={{ cursor: "pointer", background: win === s.key ? "rgba(96,165,250,0.15)" : "transparent" }}>
                          <td>{s.label}</td>
                          <td>{s.r.n}</td><td className="ok">{s.r.o}</td>
                          <td className="bad">{s.r.u}{s.r.push ? `+${s.r.push}p` : ""}</td>
                          <td>{pct(s.r.pct)}</td><td>{avg != null ? avg.toFixed(1) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div>
                  <div className="text-xs note" style={{ marginBottom: 2 }}>All books (O / U):</div>
                  {p.books.map((b: PropBook, bi: number) => (
                    <div key={bi} className="text-xs" style={{ background: "var(--bg)", padding: "3px 6px", borderRadius: 4, marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
                      <span>{BOOK_URLS[b.book] ? <a href={BOOK_URLS[b.book]} target="_blank" rel="noopener">{b.book}</a> : b.book}</span>
                      <span>{b.line}: O {fo(b.over)} / U {fo(b.under)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-xs note" style={{ marginTop: 4 }}>
                &ldquo;Over&rdquo; = above {line}; &ldquo;Under&rdquo; = below; exactly {line} = push (p)
              </div>
              <div style={{ marginTop: 6 }}>
                <button className="b sm" onClick={() => setActiveTab("parlay")}>Open parlay builder</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

