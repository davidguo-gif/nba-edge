"use client";

import { useMemo, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { decOdds, teamRank } from "@/lib/nba";
import { fmtOdds, parseOdds } from "@/lib/odds";
import { MARKET_NAMES } from "@/types";
import type { PickRecord } from "@/types";
import { NumInput } from "./NumInput";
import { OddsInput } from "./OddsInput";

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const dec = decOdds;

/* ---------- 1. where each kind of data lives on the site ---------- */
const DATA_MAP: { kind: string; what: string; where: string }[] = [
  { kind: "Historical performance", what: "Game logs, hit rates over L5, L10, L15, season and H2H", where: "Props tab and Players tab" },
  { kind: "Team efficiency", what: "Offensive and defensive rating, pace, net rating", where: "Slate and Teams tabs, matchup tool below" },
  { kind: "Shooting efficiency", what: "TS% for every player, season vs last 10", where: "Efficiency table below" },
  { kind: "Matchups", what: "Defense ranked against each position and stat", where: "Props tab, Opp rank column" },
  { kind: "Injuries and rotation", what: "Who is out, their minutes, and how it shifts each prop", where: "Props tab, injury section" },
  { kind: "Schedule and rest", what: "B2B, 4-in-5, days of rest, travel spots", where: "Slate tab" },
  { kind: "Market odds", what: "Sharp book consensus vs the sportsbooks you bet at", where: "Props tab, EV column" },
  { kind: "Your results", what: "Every saved pick graded hit or miss, plus tracked bets", where: "Props tab (past days), Tracker tab, review below" },
];

/* ---------- 2. value calculator ---------- */
function ValueCalc() {
  const { oddsFormat } = useNBA();
  const [p, setP] = useState(55);
  const [text, setText] = useState(["-110", "-105", "+100"].map((x) => fmtOdds(parseOdds(x, "american") ?? -110, oddsFormat)).join(", "));
  const odds = text
    .split(",")
    .map((x) => parseOdds(x.trim(), oddsFormat))
    .filter((x): x is number => x != null);
  const rows = odds.map((o) => ({ o, imp: 1 / dec(o), ev: (p / 100) * (dec(o) - 1) - (1 - p / 100) }));
  const best = rows.reduce<(typeof rows)[number] | null>((b, r) => (!b || r.ev > b.ev ? r : b), null);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Value and line-shopping calculator</h3>
      <ul className="jot note" style={{ marginBottom: 8 }}>
        <li>Implied probability = 1 / decimal odds</li>
        <li>A bet has value when your true probability beats the implied probability</li>
        <li>Enter the same prop&apos;s odds at several books to find the best price</li>
      </ul>
      <div className="form">
        <label>
          Your win probability %<NumInput value={p} min={0} onChange={setP} />
        </label>
        <label style={{ flex: 1, minWidth: 220 }}>
          Odds at each book ({oddsFormat}, comma-separated)
          <input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
      {rows.length > 0 && (
        <table style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Odds</th><th className="num">Implied</th><th className="num">Break-even</th><th className="num">Edge</th><th className="num">EV per 1u</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><b>{fmtOdds(r.o, oddsFormat)}</b></td>
                <td className="num">{pct(r.imp)}</td>
                <td className="num">{pct(r.imp)}</td>
                <td className={`num ${p / 100 - r.imp >= 0 ? "ok" : "bad"}`}>{p / 100 - r.imp >= 0 ? "+" : ""}{((p / 100 - r.imp) * 100).toFixed(1)} pts</td>
                <td className={`num ${r.ev >= 0 ? "ok" : "bad"}`}>{r.ev >= 0 ? "+" : ""}{r.ev.toFixed(3)}u</td>
                <td>{best === r && r.ev > 0 ? <span className="tag ok">Best price</span> : best === r ? <span className="tag">Least bad</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------- 3. vig / no-vig ---------- */
function VigCalc() {
  const { oddsFormat } = useNBA();
  const [over, setOver] = useState(-115);
  const [under, setUnder] = useState(-105);
  const po = 1 / dec(over);
  const pu = 1 / dec(under);
  const hold = po + pu - 1;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Vig and true probability</h3>
      <ul className="jot note" style={{ marginBottom: 8 }}>
        <li>Both sides of a prop add up to more than 100%, the extra is the book&apos;s cut (vig)</li>
        <li>Remove it to get the no-vig probability, the fair price to compare against</li>
        <li>The EV column on the Props tab does this for every sharp book</li>
      </ul>
      <div className="form">
        <label>Over ({oddsFormat})<OddsInput american={over} onChange={setOver} /></label>
        <label>Under ({oddsFormat})<OddsInput american={under} onChange={setUnder} /></label>
      </div>
      <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat"><span>Book hold</span><b className={hold > 0.06 ? "bad" : ""}>{pct(hold)}</b></div>
        <div className="stat"><span>No-vig Over</span><b>{pct(po / (po + pu))}</b></div>
        <div className="stat"><span>No-vig Under</span><b>{pct(pu / (po + pu))}</b></div>
      </div>
    </div>
  );
}

/* ---------- 4. team matchup ---------- */
function Matchup() {
  const { state } = useNBA();
  const { T, SLATE } = state;
  const abbrs = Object.keys(T).sort();
  const [a, setA] = useState(SLATE[0]?.away || abbrs[0]);
  const [b, setB] = useState(SLATE[0]?.home || abbrs[1]);
  const A = T[a];
  const B = T[b];
  const rows: [string, (t: typeof A) => string, (ab: string) => number | null][] = [
    ["Offensive rating", (t) => t.ortg.toFixed(1), (ab) => teamRank(T, ab, "ortg")],
    ["Defensive rating", (t) => t.drtg.toFixed(1), (ab) => teamRank(T, ab, "drtg")],
    ["Net rating", (t) => t.net.toFixed(1), () => null],
    ["Pace", (t) => t.pace.toFixed(1), () => null],
    ["Record", (t) => `${t.w}-${t.l}`, () => null],
    ["Last 10", (t) => t.l10, () => null],
    ["B2B margin drop", (t) => t.b2bDrop.toFixed(1), () => null],
  ];
  const pace = A && B ? (A.pace + B.pace) / 2 : 0;
  const ptsA = A && B ? (pace / 100) * ((A.ortg + B.drtg) / 2) : 0;
  const ptsB = A && B ? (pace / 100) * ((B.ortg + A.drtg) / 2) : 0;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Matchup breakdown</h3>
      <ul className="jot note" style={{ marginBottom: 8 }}>
        <li>Compare efficiency and pace head to head</li>
        <li>Expected points = pace x the average of one offense and the other defense</li>
        <li>Fast vs fast leans Over, slow vs slow leans Under</li>
      </ul>
      <div className="form">
        <label>Away<select value={a} onChange={(e) => setA(e.target.value)}>{abbrs.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Home<select value={b} onChange={(e) => setB(e.target.value)}>{abbrs.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      {A && B && (
        <>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th></th><th className="num">{a}</th><th className="num">{b}</th></tr></thead>
            <tbody>
              {rows.map(([label, f, rk]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{f(A)}{rk(a) != null && <span className="note"> ({rk(a)}{ordSuffix(rk(a)!)})</span>}</td>
                  <td className="num">{f(B)}{rk(b) != null && <span className="note"> ({rk(b)}{ordSuffix(rk(b)!)})</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="stat"><span>{a} expected</span><b>{ptsA.toFixed(1)}</b></div>
            <div className="stat"><span>{b} expected</span><b>{ptsB.toFixed(1)}</b></div>
            <div className="stat"><span>Projected total</span><b>{(ptsA + ptsB).toFixed(1)}</b><small className="note">{pace >= 100 ? "fast pace" : pace <= 98.5 ? "slow pace" : "average pace"}</small></div>
          </div>
        </>
      )}
    </div>
  );
}
const ordSuffix = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th");

/* ---------- 5. efficiency (TS%) ---------- */
function Efficiency() {
  const { state } = useNBA();
  const [team, setTeam] = useState("all");
  const [sort, setSort] = useState<"szn" | "l10" | "trend" | "pts">("szn");
  const ts = (games: { pts: number; fga: number; fta: number }[]) => {
    const pts = games.reduce((s, g) => s + g.pts, 0);
    const att = games.reduce((s, g) => s + g.fga + 0.44 * g.fta, 0);
    return att > 0 ? pts / (2 * att) : null;
  };
  const rows = useMemo(() => {
    return state.PLAYERS.map((pl) => {
      const cur = pl.log.filter((g) => g.date >= state.seasonStart);
      const l10 = pl.log.slice(0, 10);
      const s = ts(cur);
      const l = ts(l10);
      return { pl, n: cur.length, szn: s, l10: l, trend: s != null && l != null ? l - s : null };
    })
      .filter((r) => r.n >= 5 && r.pl.min >= 20 && r.szn != null && (team === "all" || r.pl.team === team))
      .sort((a, b) =>
        sort === "pts" ? b.pl.pts - a.pl.pts : sort === "l10" ? (b.l10 ?? 0) - (a.l10 ?? 0) : sort === "trend" ? (b.trend ?? 0) - (a.trend ?? 0) : (b.szn ?? 0) - (a.szn ?? 0),
      )
      .slice(0, 25);
  }, [state.PLAYERS, state.seasonStart, team, sort]);
  return (
    <div>
      <h3>Shooting efficiency (TS%)</h3>
      <ul className="jot note">
        <li>TS% = PTS / (2 x (FGA + 0.44 x FTA)), it counts threes and free throws</li>
        <li>League average is about 58%</li>
        <li>A player shooting well above his season TS% over L10 is hot and likely to regress</li>
        <li>An efficient scorer with a high line is a better Over than a volume scorer shooting poorly</li>
      </ul>
      <div className="filters">
        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="all">All teams</option>
          {Object.keys(state.T).sort().map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="szn">Sort by season TS%</option>
          <option value="l10">Sort by L10 TS%</option>
          <option value="trend">Sort by hottest trend</option>
          <option value="pts">Sort by points</option>
        </select>
        <span className="note">20+ mpg, 5+ games</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Player</th><th className="num">MPG</th><th className="num">PPG</th><th className="num">Season TS%</th><th className="num">L10 TS%</th><th className="num">Trend</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pl.id}>
                <td><b>{r.pl.name}</b> <span className="note">{r.pl.team}</span></td>
                <td className="num">{r.pl.min.toFixed(1)}</td>
                <td className="num">{r.pl.pts.toFixed(1)}</td>
                <td className="num">{pct(r.szn!)}</td>
                <td className="num">{r.l10 != null ? pct(r.l10) : "-"}</td>
                <td className={`num ${(r.trend ?? 0) > 0.03 ? "ok" : (r.trend ?? 0) < -0.03 ? "bad" : ""}`}>
                  {r.trend == null ? "-" : `${r.trend >= 0 ? "+" : ""}${(r.trend * 100).toFixed(1)} pts`}
                  {r.trend != null && r.trend > 0.05 && <span className="note"> hot</span>}
                  {r.trend != null && r.trend < -0.05 && <span className="note"> cold</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- 6. review your results ---------- */
function Review() {
  const { history } = useNBA();
  const settled = history.filter((r) => r.result !== "pending");
  const group = (key: (r: PickRecord) => string, label: (k: string) => string) => {
    const m = new Map<string, PickRecord[]>();
    settled.forEach((r) => m.set(key(r), [...(m.get(key(r)) || []), r]));
    return [...m.entries()]
      .map(([k, rs]) => {
        const w = rs.filter((r) => r.result === "win").length;
        const l = rs.filter((r) => r.result === "loss").length;
        const net = rs.reduce((s, r) => s + (r.result === "win" ? dec(r.odds) - 1 : r.result === "loss" ? -1 : 0), 0);
        return { k, label: label(k), w, l, push: rs.length - w - l, net, roi: w + l ? net / (w + l) : null };
      })
      .sort((a, b) => b.w + b.l - (a.w + a.l));
  };
  const sections: [string, ReturnType<typeof group>][] = [
    ["By prop type", group((r) => r.market, (k) => MARKET_NAMES[k] || k)],
    ["By side", group((r) => r.side, (k) => (k === "over" ? "Over" : "Under"))],
    ["By rating grade", group((r) => r.grade, (k) => `Grade ${k}`)],
    ["By sportsbook", group((r) => r.book, (k) => k)],
    ["By edge size", group((r) => (r.ev >= 0.08 ? "strong" : "lean"), (k) => (k === "strong" ? "Strong (8%+ EV)" : "Lean (3-8% EV)"))],
  ];
  return (
    <div>
      <h3>Review and refine</h3>
      <ul className="jot note">
        <li>Track every pick, then check which kinds actually win before trusting a model</li>
        <li>Small samples are noise, wait for 30+ picks in a group before drawing conclusions</li>
        <li>If a grade or prop type loses money over a large sample, stop betting it or recalibrate</li>
      </ul>
      {settled.length === 0 ? (
        <div className="empty">No graded picks yet. Picks are saved when you fetch odds and graded once box scores are in the data.</div>
      ) : (
        <div className="grid g2">
          {sections.map(([title, rows]) => (
            <div className="card" key={title}>
              <h3 style={{ marginTop: 0 }}>{title}</h3>
              <table className="mini" style={{ fontSize: 12 }}>
                <thead><tr><th>Group</th><th>W-L</th><th>Hit</th><th>Units</th><th>ROI</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.k}>
                      <td>{r.label}</td>
                      <td>{r.w}-{r.l}{r.push ? `-${r.push}` : ""}</td>
                      <td>{r.w + r.l ? pct(r.w / (r.w + r.l), 0) : "-"}</td>
                      <td className={r.net >= 0 ? "ok" : "bad"}>{r.net >= 0 ? "+" : ""}{r.net.toFixed(2)}</td>
                      <td className={(r.roi ?? 0) >= 0 ? "ok" : "bad"}>{r.roi == null ? "-" : pct(r.roi, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalyticsTab() {
  return (
    <div>
      <h2>Analytics</h2>
      <p className="sub">Use the data, not gut feel. Basketball versions of the core sports betting analytics ideas.</p>

      <h3>Where the data lives</h3>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Data</th><th>What you get</th><th>Where on D Pics</th></tr></thead>
          <tbody>
            {DATA_MAP.map((r) => (
              <tr key={r.kind}><td><b>{r.kind}</b></td><td>{r.what}</td><td>{r.where}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid g2" style={{ marginTop: 12 }}>
        <ValueCalc />
        <VigCalc />
      </div>
      <div style={{ marginTop: 12 }}><Matchup /></div>
      <Efficiency />
      <Review />
    </div>
  );
}
