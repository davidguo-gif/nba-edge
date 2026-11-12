"use client";

import { useEffect, useRef, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { store, save } from "@/lib/store";
import { fmtO, decOdds } from "@/lib/nba";
import { fmtOdds, parseOdds } from "@/lib/odds";
import { OddsInput } from "./OddsInput";
import { NumInput } from "./NumInput";

const CHECK = [
  "Checked both teams' rest days and B2B status",
  "Reviewed travel schedule (cross-country? road trip length?)",
  "Compared pace factors for total implications",
  "Checked offensive/defensive ratings for matchup context",
  "Reviewed injury report and rotation impacts",
  "Noted line movement from open to current",
  "Identified specific edge (not just 'liking' a team)",
  "Bet size appropriate for confidence level (1-3% max)",
];

const FAQ: [string, string][] = [
  [
    "What is the best NBA betting strategy?",
    "Combine schedule analysis (B2Bs and rest), fourth-quarter patterns, and disciplined bankroll management. Bet situations, not team reputations.",
  ],
  [
    "What is the 1-3-2-6 system?",
    "A positive progression: 1, 3, 2, then 6 units after each win. Restart at 1 unit after any loss or after completing the sequence. No staking system overcomes negative-EV bets.",
  ],
  [
    "How many back-to-backs do teams play?",
    "About 14.9 per team in 2024-25, down 23% from a decade ago. Road teams on B2Bs show a 1-3 point decline.",
  ],
  [
    "Does overtime count?",
    "Yes for moneylines, spreads and full-game totals at most books. Some props and quarter bets exclude OT; check house rules.",
  ],
  [
    "What is ATS?",
    "Against the spread. A 30-20 ATS record means the team covered 60% of games.",
  ],
  [
    "How does fatigue affect shooting?",
    "García et al. (2020): effect size of -1.27 between Q1 and Q4; three-point accuracy suffers more than rim shots.",
  ],
  [
    "How does pace affect totals?",
    "High-pace (100+) teams create more scoring chances. Q4 pace in close games drops to 90-100 possessions.",
  ],
  [
    "Is home court advantage real?",
    "Yes, mostly in close games (Wang et al. 2024: 50%+ home win rate in close games), but smaller than historical norms.",
  ],
];

const MISTAKES = [
  "Betting names instead of situations",
  "Ignoring schedule context",
  "Chasing losses with increased stakes",
  "Overvaluing recent performance (regression to the mean)",
  "Parlaying random, uncorrelated events",
];

const SCHEDULE: [string, string, string, string][] = [
  ["Road team on B2B vs rested opponent", "2-3 pt decline", "Fade road team ATS", "Spread, team total Under"],
  ["Both teams on B2B", "Lower pace, sloppy", "Game total Under", "Full game total"],
  ["Home team 3+ days rest vs traveling team", "1-2 pt advantage", "Back rested home team", "Spread, 1H spread"],
  ["4 games in 5 nights", "Significant fatigue", "Totals, fade tired team", "Total, Q4 props"],
  ["Post-road-trip home opener", "Motivated", "Back home team early", "1H spread"],
];

export function SystemsTab() {
  const [checks, setChecks] = useState<number[]>(store<number[]>("check", []));
  const [b2b, setB2b] = useState("none");
  const [loc, setLoc] = useState("home");
  const [pace, setPace] = useState("mixed");
  const [kellyP, setKellyP] = useState(55);
  const [kellyO, setKellyO] = useState(-110);
  const [kellyF, setKellyF] = useState("0.25");
  const [kellyB, setKellyB] = useState(store<number>("bank", 1000));
  const { oddsFormat } = useNBA();
  const [plOdds, setPlOdds] = useState(fmtOdds(-110, oddsFormat) + ", " + fmtOdds(-110, oddsFormat));
  // re-express the typed legs when the odds format is switched
  const fmtRef = useRef(oddsFormat);
  useEffect(() => {
    if (fmtRef.current === oddsFormat) return;
    const old = fmtRef.current;
    fmtRef.current = oddsFormat;
    setPlOdds((t) =>
      t
        .split(",")
        .map((x) => {
          const a = parseOdds(x.trim(), old);
          return a == null ? x.trim() : fmtOdds(a, oddsFormat);
        })
        .join(", "),
    );
  }, [oddsFormat]);
  const [plStake, setPlStake] = useState(10);

  const toggleCheck = (i: number) => {
    const next = checks.includes(i) ? checks.filter((x) => x !== i) : [...checks, i];
    setChecks(next);
    save("check", next);
  };

  const dec = (o: number) => (o > 0 ? 1 + o / 100 : 1 + 100 / -o);
  const totalResult = () => {
    if (b2b === "both") return ["Lean UNDER", "Both teams fatigued: suppressed scoring."];
    if (b2b === "one") {
      if (loc === "road" && pace !== "fast")
        return ["Slight UNDER", "Road fatigue suggests modest scoring suppression."];
      return ["No strong lean", "Mixed factors; consider spreads or props instead."];
    }
    if (pace === "fast") return ["Lean OVER", "Fresh teams with fast pace create more possessions."];
    if (pace === "slow") return ["Lean UNDER", "Slow defensive teams suppress scoring."];
    return ["No strong lean", "Mixed factors; pass or look elsewhere."];
  };
  const tr = totalResult();

  let kelOut = "";
  const kP = kellyP / 100,
    kD = dec(kellyO) - 1;
  const kel = (kD * kP - (1 - kP)) / kD;
  const kSt = Math.max(0, kel * +kellyF);
  if (kel <= 0) kelOut = "No edge at this price: no bet.";
  else
    kelOut = `Stake ${(kSt * 100).toFixed(2)}% of bankroll = $${(kSt * kellyB).toFixed(2)}. Full Kelly ${(kel * 100).toFixed(1)}%.${kSt > 0.03 ? " Exceeds 3% cap — cap at 3%." : ""}`;

  let plOut = "";
  const legs = plOdds
    .split(",")
    .map((x) => parseOdds(x.trim(), oddsFormat))
    .filter((x): x is number => x != null);
  const plD = legs.reduce((a, o) => a * dec(o), 1);
  if (legs.length >= 2) {
    const warn: string[] = [];
    if (legs.length > 4) warn.push("More than 4 legs: variance explodes.");
    if (legs.some((o) => o <= -300)) warn.push("Heavy favorite leg (-300 or worse): poor parlay value.");
    plOut = `${legs.length} legs: pays $${(plStake * (plD - 1)).toFixed(2)} (return $${(plStake * plD).toFixed(2)}). Implied ${(100 / plD).toFixed(1)}%.${warn.map((w) => " " + w).join("")}`;
  }

  return (
    <div>
      <h2>Systems &amp; Tools</h2>
      <div className="grid g4" style={{ marginTop: 8 }}>
        <div className="card stat">
          <b>19%</b>
          <span>of games decided in Q4</span>
        </div>
        <div className="card stat">
          <b>90-100</b>
          <span>Q4 possessions in close games</span>
        </div>
        <div className="card stat">
          <b>14.9</b>
          <span>avg B2Bs per team (2024-25)</span>
        </div>
        <div className="card stat">
          <b>-1.27</b>
          <span>Q1 to Q4 fatigue effect size</span>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pre-game checklist</h3>
          {CHECK.map((c, i) => (
            <label key={i} className="row">
              <input
                type="checkbox"
                checked={checks.includes(i)}
                onChange={() => toggleCheck(i)}
              />
              {c}
            </label>
          ))}
          <button className="b alt sm" onClick={() => { setChecks([]); save("check", []); }}>
            Reset
          </button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Over/Under decision tool</h3>
          <div className="form">
            <label>
              Back-to-back
              <select value={b2b} onChange={(e) => setB2b(e.target.value)}>
                <option value="none">Neither team</option>
                <option value="one">One team</option>
                <option value="both">Both teams</option>
              </select>
            </label>
            <label>
              B2B team location
              <select value={loc} onChange={(e) => setLoc(e.target.value)}>
                <option value="home">Home</option>
                <option value="road">Road</option>
              </select>
            </label>
            <label>
              Pace matchup
              <select value={pace} onChange={(e) => setPace(e.target.value)}>
                <option value="fast">Both fast (100+)</option>
                <option value="mixed" selected>Mixed</option>
                <option value="slow">Both slow/defensive</option>
              </select>
            </label>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            <b>{tr[0]}</b>
            <br />
            <span className="note">{tr[1]}</span>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Kelly criterion</h3>
          <div className="form">
            <label>
              Win %<NumInput value={kellyP} min={0} onChange={setKellyP} />
            </label>
            <label>
              Odds ({oddsFormat})<OddsInput american={kellyO} onChange={setKellyO} />
            </label>
            <label>
              Fraction
              <select value={kellyF} onChange={(e) => setKellyF(e.target.value)}>
                <option value="0.25">25%</option>
                <option value="0.5">50%</option>
                <option value="1">Full</option>
              </select>
            </label>
            <label>
              Bankroll<NumInput value={kellyB} min={1} onChange={(n) => { setKellyB(n); save("bank", n); }} />
            </label>
          </div>
          <div className="note" style={{ marginTop: 10 }}>{kelOut}</div>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Parlay calculator</h3>
          <div className="form">
            <label>
              Leg odds ({oddsFormat}, comma-separated)<input value={plOdds} onChange={(e) => setPlOdds(e.target.value)} />
            </label>
            <label>
              Stake<NumInput value={plStake} min={0} onChange={setPlStake} />
            </label>
          </div>
          <div className="note" style={{ marginTop: 10 }}>{plOut || "Enter 2+ legs."}</div>
        </div>
      </div>

      <h3>Game-total formula</h3>
      <div className="card">
        Expected Points = (Team A Pace x Team A Efficiency + Team B Pace x Team B Efficiency) / 2. Pace is the best predictor of total score. Elite offenses score 115+ per 100 possessions.
      </div>

      <h3>Schedule spots</h3>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Situation</th>
              <th>Impact</th>
              <th>Lean</th>
              <th>Best bet</th>
            </tr>
          </thead>
          <tbody>
            {SCHEDULE.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid g3">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>5-step game analysis</h3>
          <ol className="clean">
            <li>Check schedule context (rest, B2B, travel)</li>
            <li>Analyze pace metrics</li>
            <li>Review efficiency (ORtg/DRtg, TS%, form)</li>
            <li>Check injury reports and rotation changes</li>
            <li>Evaluate line movement (1+ spread pts, 3+ total pts = sharp or news)</li>
          </ol>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Fourth-quarter scenarios</h3>
          <ul className="clean">
            <li><b>Lean Under:</b> within 5 pts entering Q4, starters 35+ min</li>
            <li><b>Fade road team:</b> close game, road B2B vs rested home</li>
            <li><b>Star props Over:</b> projected close game, star 32+ MPG</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Props by position</h3>
          <ul className="clean">
            <li><b>Guards</b> run 5+ miles: B2B scoring/assist unders</li>
            <li><b>Wings</b> are matchup-dependent</li>
            <li><b>Centers</b> hold per-minute output: rebounding props OK on B2B</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Parlay rules</h3>
          <ul className="clean">
            <li>Keep to 2-4 legs</li>
            <li>Avoid -300 or heavier favorites</li>
            <li>Use correlation (e.g. Celtics -5.5 + Under 224.5 when Lakers on B2B)</li>
            <li>Don&apos;t force parlays</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Bankroll</h3>
          <ul className="clean">
            <li>Start with 50-100 units</li>
            <li>Never more than 3% on one game; most bets 1-2%</li>
            <li>Flat 1-2u, confidence 1-3u, or 25-50% Kelly</li>
            <li>Live bets: 50-75% of normal unit; pre-set your spots</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Costly mistakes</h3>
          <ol className="clean">
            {MISTAKES.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ol>
        </div>
      </div>

      <h3>FAQ</h3>
      {FAQ.map(([q, a], i) => (
        <details key={i}>
          <summary style={{ cursor: "pointer", color: "var(--blue)" }}>{q}</summary>
          <p className="note" style={{ marginTop: 4 }}>{a}</p>
        </details>
      ))}
      <p className="note">
        Source:{" "}
        <a href="https://www.topendsports.com/betting-guides/sport-specific/nba/strategy.htm" target="_blank" rel="noopener">
          TopEndSports NBA Betting Strategy
        </a>
      </p>
    </div>
  );
}