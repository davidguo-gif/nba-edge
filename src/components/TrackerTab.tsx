"use client";

import { useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { fmtO, decOdds } from "@/lib/nba";
import { BOOK_URLS } from "@/types";

export function TrackerTab() {
  const {
    bets,
    addBet,
    updateBetResult,
    removeBet,
    bankroll,
    setBankroll,
    unitPct,
    setUnitPct,
  } = useNBA();
  const [desc, setDesc] = useState("");
  const [book, setBook] = useState("DraftKings");
  const [odds, setOdds] = useState(-110);
  const [units, setUnits] = useState(1);

  const unit = (bankroll * unitPct) / 100;
  const profit = (b: (typeof bets)[0]) =>
    b.result === "win"
      ? b.units * (decOdds(b.odds) - 1)
      : b.result === "loss"
        ? -b.units
        : 0;

  const settled = bets.filter((b) => b.result !== "pending");
  const staked = settled
    .filter((b) => b.result !== "push")
    .reduce((s, b) => s + b.units, 0);
  const net = settled.reduce((s, b) => s + profit(b), 0);
  const w = settled.filter((b) => b.result === "win").length;
  const l = settled.filter((b) => b.result === "loss").length;
  const pus = settled.length - w - l;

  return (
    <div>
      <h2>Bet Tracker</h2>
      <p className="sub">
        1-2 units per bet recommended; never more than 3% of bankroll on one
        game.
      </p>

      <div className="grid g4">
        <div className="card stat">
          <b>
            {w}-{l}
            {pus ? `-${pus}` : ""}
          </b>
          <span>Record</span>
        </div>
        <div className="card stat">
          <b className={net >= 0 ? "ok" : "bad"}>
            {net >= 0 ? "+" : ""}
            {net.toFixed(2)}u
          </b>
          <span>Net units (${(net * unit).toFixed(2)})</span>
        </div>
        <div className="card stat">
          <b>{staked ? `${(net / staked * 100).toFixed(1)}%` : "-"}</b>
          <span>ROI</span>
        </div>
        <div className="card stat">
          <b>{bets.filter((b) => b.result === "pending").length}</b>
          <span>Pending</span>
        </div>
      </div>

      <div className="card" style={{ margin: "12px 0" }}>
        <div className="form">
          <label>
            Bankroll ($)
            <input
              type="number"
              value={bankroll}
              onChange={(e) => setBankroll(+e.target.value || 1000)}
            />
          </label>
          <label>
            Unit size (%)
            <input
              type="number"
              step="0.25"
              value={unitPct}
              onChange={(e) => setUnitPct(+e.target.value || 1)}
            />
          </label>
          <div className="note">1 unit = ${unit.toFixed(2)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form">
          <label>
            Description
            <input
              placeholder="e.g. Brunson O 27.5 PTS"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>
          <label>
            Book
            <select value={book} onChange={(e) => setBook(e.target.value)}>
              {(["DraftKings", "FanDuel", "BetMGM", "Caesars", "ESPN BET", "Fanatics"] as const).map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            Odds
            <input
              type="number"
              value={odds}
              onChange={(e) => setOdds(+e.target.value)}
            />
          </label>
          <label>
            Units
            <input
              type="number"
              step="0.5"
              value={units}
              onChange={(e) => setUnits(+e.target.value || 1)}
            />
          </label>
          <button
            className="b"
            onClick={() => {
              if (!desc.trim()) return;
              addBet(desc.trim(), book, odds, units);
              setDesc("");
            }}
          >
            Add bet
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Bet</th>
              <th>Book</th>
              <th className="num">Odds</th>
              <th className="num">Units</th>
              <th>Result</th>
              <th className="num">P/L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...bets].reverse().map((b) => (
              <tr key={b.id}>
                <td>{b.date}</td>
                <td>
                  {b.desc}
                  {b.units > 3 && (
                    <span className="tag bad" style={{ marginLeft: 4 }}>
                      over 3u
                    </span>
                  )}
                </td>
                <td>
                  {BOOK_URLS[b.book] ? (
                    <a href={BOOK_URLS[b.book]} target="_blank" rel="noopener">
                      {b.book}
                    </a>
                  ) : (
                    b.book
                  )}
                </td>
                <td className="num">{fmtO(b.odds)}</td>
                <td className="num">{b.units}</td>
                <td>
                  <select
                    value={b.result}
                    onChange={(e) =>
                      updateBetResult(
                        b.id,
                        e.target.value as "pending" | "win" | "loss" | "push",
                      )
                    }
                  >
                    {["pending", "win", "loss", "push"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className={`num ${profit(b) >= 0 ? "ok" : "bad"}`}>
                  {b.result === "pending" ? "-" : `${profit(b).toFixed(2)}u`}
                </td>
                <td>
                  <button
                    className="b alt sm"
                    onClick={() => removeBet(b.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {bets.length === 0 && (
              <tr>
                <td colSpan={8} className="note">
                  No bets yet. Add one above or from a prop.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}