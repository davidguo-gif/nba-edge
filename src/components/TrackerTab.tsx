"use client";

import { useMemo, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { decOdds } from "@/lib/nba";
import { fmtOdds } from "@/lib/odds";
import { OddsInput } from "./OddsInput";
import { NumInput } from "./NumInput";
import { BOOK_URLS } from "@/types";

type DateFilter = "today" | "3d" | "week" | "month" | "season" | "all";

const FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "3d", label: "Last 3 days" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "season", label: "This season" },
  { value: "all", label: "All time" },
];

const todayET = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "America/New_York" });
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${dateStr} ${timeStr}`;
}

function dateInRange(isoDate: string, filter: DateFilter): boolean {
  const betDate = isoDate.slice(0, 10); // YYYY-MM-DD
  const today = todayET();

  switch (filter) {
    case "today":
      return betDate === today;
    case "3d": {
      const d = new Date(today + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 3);
      return betDate >= d.toISOString().slice(0, 10);
    }
    case "week": {
      const d = new Date(today + "T00:00:00Z");
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
      d.setUTCDate(diff);
      return betDate >= d.toISOString().slice(0, 10);
    }
    case "month": {
      const m = today.slice(0, 7); // YYYY-MM
      return betDate.slice(0, 7) === m;
    }
    case "season": {
      const year = +today.slice(0, 4);
      const month = +today.slice(5, 7);
      const seasonStart = month >= 10 ? `${year}-10-01` : `${year - 1}-08-01`;
      return betDate >= seasonStart;
    }
    default:
      return true;
  }
}

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
    oddsFormat,
  } = useNBA();
  const [desc, setDesc] = useState("");
  const [book, setBook] = useState("DraftKings");
  const [odds, setOdds] = useState(-110);
  const [units, setUnits] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const unit = (bankroll * unitPct) / 100;
  const profit = (b: (typeof bets)[0]) =>
    b.result === "win"
      ? b.units * (decOdds(b.odds) - 1)
      : b.result === "loss"
        ? -b.units
        : 0;

  const filteredBets = useMemo(
    () => [...bets].filter((b) => dateInRange(b.date, dateFilter)).reverse(),
    [bets, dateFilter],
  );

  const allReverse = useMemo(() => [...bets].reverse(), [bets]);

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
            <NumInput value={bankroll} min={1} onChange={setBankroll} />
          </label>
          <label>
            Unit size (%)
            <NumInput value={unitPct} min={0.01} step="0.25" onChange={setUnitPct} />
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
            Odds ({oddsFormat})
            <OddsInput american={odds} onChange={setOdds} />
          </label>
          <label>
            Units
            <NumInput value={units} min={0.01} step="0.5" onChange={setUnits} />
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

      <div className="filters">
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
          {FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="note">{filteredBets.length} bet{filteredBets.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
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
            {filteredBets.map((b) => (
              <tr key={b.id}>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(b.date)}</td>
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
                <td className="num">{fmtOdds(b.odds, oddsFormat)}</td>
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
            {filteredBets.length === 0 && (
              <tr>
                <td colSpan={8} className="note">
                  {dateFilter === "today" ? "No bets placed today." : `No bets in this period.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}