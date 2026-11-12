"use client";

import { useEffect, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { BOOK_URLS, type PropBook, type Player, type SlateGame } from "@/types";
import { windows, record, defExplain, prevSeasonLabel, mktWord, posWord, ord, decOdds } from "@/lib/nba";
import { bestPrice, propLeg } from "@/lib/parlay";
import { fmtOdds } from "@/lib/odds";

const MK: Record<string, string> = { pts: "PTS", reb: "REB", ast: "AST", fg3: "3PM", pra: "PRA" };
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

type GameRow = { date: string; opp: string; home: boolean; [k: string]: any };

/** Bars = one game each (oldest to newest); dashed line = the prop line. */
function BarChart({ games, stat, line }: { games: GameRow[]; stat: string; line: number }) {
  if (!games.length) return <div className="text-xs note">No games in this period.</div>;
  const data = [...games].reverse(); // oldest -> newest
  const vals = data.map((g) => g[stat] as number);
  const top = Math.max(...vals, line, 1) * 1.15;
  const W = 640,
    H = 200,
    padL = 30,
    padB = 30,
    padT = 14;
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
          <text x={padL - 4} y={y(t) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {data.map((g, i) => {
        const v = vals[i];
        const x = padL + i * slot + (slot - bw) / 2;
        const color = v > line ? "#4ade80" : v < line ? "#f87171" : "#94a3b8";
        return (
          <g key={i}>
            <title>{`${shortDate(g.date)} ${g.home ? "vs" : "@"} ${g.opp}: ${v}`}</title>
            <rect x={x} y={y(v)} width={bw} height={Math.max(1, y(0) - y(v))} fill={color} rx={2} />
            {!many && (
              <text x={x + bw / 2} y={y(v) - 3} fontSize={10} fill="#e2e8f0" textAnchor="middle">
                {v}
              </text>
            )}
            {!many && (
              <text x={x + bw / 2} y={H - padB + 11} fontSize={9} fill="#94a3b8" textAnchor="middle">
                {g.home ? "" : "@"}
                {g.opp}
              </text>
            )}
            {!many && (
              <text x={x + bw / 2} y={H - padB + 21} fontSize={8} fill="#64748b" textAnchor="middle">
                {shortDate(g.date)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={padL} x2={W} y1={y(line)} y2={y(line)} stroke="#fcd34d" strokeWidth={1.5} strokeDasharray="5 3" />
      <text x={W - 2} y={y(line) - 4} fontSize={10} fill="#fcd34d" textAnchor="end">
        Line {line}
      </text>
    </svg>
  );
}

export function PropCard({
  p,
  pl,
  gm,
  a,
  open,
  onToggle,
  onAdded,
}: {
  p: any;
  pl: Player;
  gm: SlateGame | null;
  a: any;
  open: boolean;
  onToggle: () => void;
  onAdded: (msg: string) => void;
}) {
  const { state, addBet, addLeg, setActiveTab, oddsFormat } = useNBA();
  const { CTX } = state;
  const fo = (o: number) => fmtOdds(o, oddsFormat);

  const [line, setLine] = useState<number>(p.line);
  const [win, setWin] = useState<"l10" | "l15" | "cur" | "prev" | "h2h">("l10");
  useEffect(() => setLine(p.line), [p.line]);

  const c = CTX[pl.team];
  const opp: string = c ? c.opp : "";
  const oppName = opp ? state.T[opp]?.name || opp : "the opponent";
  const w = windows(pl, state.seasonStart);
  const h2h = opp ? pl.log.filter((g) => g.opp === opp) : [];
  const curLabel = state.season;
  const prevLabel = prevSeasonLabel(state.season);
  const sets: { key: typeof win; label: string; games: GameRow[] }[] = [
    { key: "l10", label: "Last 10", games: w.l10 },
    { key: "l15", label: "Last 15", games: w.l15 },
    { key: "cur", label: curLabel, games: w.cur },
    { key: "prev", label: prevLabel, games: w.prev },
    { key: "h2h", label: `vs ${opp || "opp"} (H2H)`, games: h2h },
  ];
  const chosen = sets.find((s) => s.key === win)!;

  const over = bestPrice(p.books, "over");
  const under = bestPrice(p.books, "under");
  const d = defExplain(a.rank, pl.pos, p.market);
  const r10 = record(w.l10, p.market, p.line);
  const r15 = record(w.l15, p.market, p.line);
  const rc = record(w.cur, p.market, p.line);

  const span = Math.max(4, Math.round(p.line * 0.6));
  const min = Math.max(0, Math.floor(p.line - span) + 0.5);
  const max = Math.ceil(p.line + span) - 0.5;

  const addToParlay = (side: "over" | "under") => {
    addLeg(propLeg(p, pl, gm, side));
    onAdded(`Added ${pl.name} ${side} to your parlay`);
  };
  const edgeOk = a.best.ev >= 0.03;

  return (
    <div
      className="card"
      style={{ cursor: "pointer", outline: open ? "1px solid var(--blue)" : "none" }}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between mb-1">
        <div>
          <b>{pl.name}</b>{" "}
          <span className="note">
            {pl.team} {pl.pos}
            {gm ? ` | vs ${pl.team === gm.home ? gm.away : gm.home}${pl.team === gm.home ? " (home)" : " (away)"}` : ""}
          </span>
        </div>
        <span
          title="Strong: 8%+ edge, Lean: 3-8% edge, Pass: under 3%"
          className={`tag ${a.conf === "Strong" ? "ok" : a.conf === "Lean" ? "warn" : ""}`}
          style={a.conf === "Pass" ? { background: "#1e293b", color: "#94a3b8" } : {}}
        >
          {a.conf}
        </span>
      </div>

      {/* jot notes */}
      <ul className="clean text-sm" style={{ margin: "2px 0 4px" }}>
        <li>
          <b>
            {MS[p.market]} O/U {p.line}
          </b>
        </li>
        <li>
          {edgeOk ? (
            <>
              Pick: <b>{a.best.side === "over" ? "OVER" : "UNDER"} {a.best.line}</b> @ {a.best.book} ({fo(a.best.odds)})
              {" | "}hit {Math.round(a.best.p * 100)}% vs {Math.round((1 / decOdds(a.best.odds)) * 100)}% implied
              {" | "}edge +{(a.best.ev * 100).toFixed(1)}%
            </>
          ) : (
            <span style={{ color: "var(--mut)" }}>No pick: odds match true hit rate (no edge)</span>
          )}
        </li>
        <li>
          Avg: <b>{p.proj}</b> {MK[p.market]}
          {pl.min ? ` in ${Math.round(pl.min)} min` : ""}
        </li>
        <li>
          Went over {p.line}: L10 <b>{r10.o}/{r10.n}</b> | L15 <b>{r15.o}/{r15.n}</b> | szn <b>{rc.o}/{rc.n}</b>
          {h2h.length ? (
            <>
              {" "}| vs {opp} <b>{record(h2h, p.market, p.line).o}/{h2h.length}</b>
            </>
          ) : null}
        </li>
        <li>
          Opp D ({opp}) vs {posWord(pl.pos)}: <b className={d.tone}>{d.strength}</b> ({ord(d.rank)}/30, 1st = toughest)
          {" "}{"\u2192"} {a.rank >= 21 ? "favors Over" : a.rank <= 10 ? "favors Under" : "neutral"}
        </li>
      </ul>
      <div className="text-xs" style={{ color: "var(--blue)" }}>
        {open ? "Click to hide history" : "Click for history, H2H graph + line slider"}
      </div>

      {open && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, cursor: "default" }}>
          {/* slider */}
          <div style={{ marginBottom: 6 }}>
            <div className="text-sm">
              <b>
                Test a different line: {line} {mktWord(p.market)}
              </b>
              {line !== p.line && (
                <span className="note">
                  {" "}
                  (book: {p.line}){" "}
                  <a style={{ cursor: "pointer" }} onClick={() => setLine(p.line)}>
                    reset
                  </a>
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button className="b sm alt" onClick={() => setLine(Math.max(0, +(line - 0.5).toFixed(1)))}>
                -0.5
              </button>
              <input
                type="range"
                min={min}
                max={max}
                step={0.5}
                value={line}
                onChange={(e) => setLine(+e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="b sm alt" onClick={() => setLine(+(line + 0.5).toFixed(1))}>
                +0.5
              </button>
            </div>
            <div className="text-xs" style={{ color: "var(--mut)" }}>
              Slider only changes the history below. Sportsbook prices are for the book line ({p.line}).
            </div>
          </div>

          {/* graph */}
          <div className="text-xs" style={{ marginBottom: 2 }}>
            <b>
              {MS[p.market]} per game, {chosen.label.toLowerCase()}
            </b>{" "}
            <span style={{ color: "var(--mut)" }}>
              (green = Over {line}, red = Under {line}; dashed = line)
            </span>
          </div>
          <BarChart games={chosen.games as GameRow[]} stat={p.market} line={line} />

          {/* table (click a row to graph it) */}
          <table className="mini" style={{ marginTop: 4 }}>
            <thead>
              <tr>
                <th>Period</th>
                <th>Games</th>
                <th>Over</th>
                <th>Under</th>
                <th>Over %</th>
                <th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => {
                const r = record(s.games, p.market, line);
                const avg = s.games.length
                  ? s.games.reduce((t, g: any) => t + g[p.market], 0) / s.games.length
                  : null;
                return (
                  <tr
                    key={s.key}
                    onClick={() => setWin(s.key)}
                    style={{
                      cursor: "pointer",
                      background: win === s.key ? "rgba(96,165,250,0.15)" : "transparent",
                    }}
                  >
                    <td>{s.label}</td>
                    <td>{r.n}</td>
                    <td className="ok">{r.o}</td>
                    <td className="bad" title={r.push ? `${r.push} push` : undefined}>
                      {r.u}
                      {r.push ? `+${r.push}p` : ""}
                    </td>
                    <td>{pct(r.pct)}</td>
                    <td>{avg == null ? "-" : avg.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="clean text-xs" style={{ color: "var(--mut)", margin: "4px 0 8px" }}>
            <li>Tap a row to graph that period</li>
            <li>Over = finished above {line}; Under = below; exactly {line} = push (p)</li>
            <li>
              H2H = games vs {oppName} in the last 2 seasons{h2h.length === 0 ? " (none on record)" : ""}
            </li>
          </ul>

          {/* bet sides */}
          <div className="grid g2" style={{ gap: 6, marginBottom: 6 }}>
            {(
              [
                ["OVER", over, "over"],
                ["UNDER", under, "under"],
              ] as const
            ).map(([label, best, side]) => (
              <div key={side} style={{ background: "var(--bg)", padding: 6, borderRadius: 4 }}>
                <div className="text-sm">
                  <b>
                    {label} {best.line}
                  </b>
                </div>
                <div className="text-xs" style={{ color: "var(--mut)" }}>
                  Best: {fo(best.price)} @ {best.book}
                </div>
                <div className="flex gap-1 mt-1">
                  <button
                    className="b sm alt"
                    onClick={() =>
                      addBet(
                        `${pl.name} ${side === "over" ? "Over" : "Under"} ${best.line} ${MS[p.market]}`,
                        best.book,
                        best.price,
                        1,
                      )
                    }
                  >
                    +Bet {side === "over" ? "Over" : "Under"}
                  </button>
                  <button className="b sm alt" onClick={() => addToParlay(side)}>
                    + Parlay
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs" style={{ color: "var(--mut)", marginBottom: 2 }}>
            All books (O / U):
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
                  {b.line}: O {fo(b.over)} / U {fo(b.under)}
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
}
