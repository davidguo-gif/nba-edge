"use client";

import { useEffect, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { defChip, ord } from "@/lib/nba";
import type { TeamData } from "@/types";

const STAT_COLS = [
  { k: "abbr", label: "Team", all: true, y26: true },
  { k: "w", label: "W-L", all: true, y26: true },
  { k: "gp", label: "GP", all: false, y26: false },
  { k: "pace", label: "Pace", all: true, y26: true },
  { k: "ortg", label: "ORtg", all: true, y26: true },
  { k: "drtg", label: "DRtg", all: true, y26: true },
  { k: "net", label: "Net", all: true, y26: true },
  { k: "ppg", label: "PPG", all: true, y26: true },
  { k: "oppg", label: "OPP PPG", all: true, y26: true },
  { k: "b2bW", label: "B2B", all: true, y26: false },
  { k: "b2bDrop", label: "B2B Drop", all: true, y26: false },
  { k: "home", label: "Home", all: true, y26: false },
  { k: "road", label: "Road", all: true, y26: false },
  { k: "l10", label: "L10", all: true, y26: true },
  { k: "streak", label: "Strk", all: true, y26: true },
];

const MS: Record<string, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  fg3: "3PM",
  pra: "PRA",
};

function cell(x: any, k: string): string {
  switch (k) {
    case "abbr":
      return `${x.abbr} <span style="color:var(--mut)">${x.name}</span>`;
    case "w":
      return `${x.w}-${x.l}`;
    case "gp":
      return String(x.gp);
    case "net": {
      const c = x.net >= 0 ? "ok" : "bad";
      return `<span class="${c}">${x.net >= 0 ? "+" : ""}${x.net.toFixed(1)}</span>`;
    }
    case "b2bW":
      return `${x.b2bW}-${x.b2bL}`;
    case "b2bDrop":
      return `-${x.b2bDrop}`;
    case "home":
    case "road":
    case "l10":
    case "streak":
      return x[k] || "-";
    default:
      return x[k] != null ? (typeof x[k] === "number" ? x[k].toFixed(1) : String(x[k])) : "-";
  }
}

export function TeamsTab() {
  const { state, selTeam, setSelTeam } = useNBA();
  // "current" = live view, "cur-only" = this season only, otherwise a past season key like "2024-25"
  const [view, setView] = useState<string>("current");
  const [past, setPast] = useState<Record<string, Record<string, any>>>({});
  useEffect(() => {
    fetch("/seasons.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setPast)
      .catch(() => {});
  }, []);
  const pastSeasons = Object.keys(past).sort().reverse();
  const pastMode = view !== "current" && view !== "cur-only";
  const y26Mode = view === "cur-only";
  const [sortCol, setSortCol] = useState("net");
  const [sortDir, setSortDir] = useState(-1);

  const sy = !!state.synced;
  const cols = STAT_COLS.filter((c) => (y26Mode ? c.y26 : c.all));

  const list = (Object.values(state.T) as TeamData[])
    .map((t) =>
      pastMode
        ? { ...t, ...(past[view]?.[t.abbr] || {}), abbr: t.abbr, name: t.name }
        : y26Mode && t.y26
          ? { ...t, ...t.y26, abbr: t.abbr, name: t.name }
          : t,
    )
    .sort((a: any, b: any) => {
      const av = a[sortCol],
        bv = b[sortCol];
      return (typeof av === "string"
        ? (av || "").localeCompare(bv || "")
        : (av ?? 0) - (bv ?? 0)) * sortDir;
    });

  const t = selTeam ? state.T[selTeam] : null;
  const inj = selTeam ? state.injuries[selTeam] : null;

  return (
    <div>
      <h2>Team Statistics</h2>
      <p className="sub">
        Click a column to sort and a team for defense vs position + injury report.
      </p>
      <div className="filters">
        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="current">Current season (ratings blended with last season)</option>
          {sy && <option value="cur-only">Current season only</option>}
          {pastSeasons.map((s) => (
            <option key={s} value={s}>
              {s} season (full regular season)
            </option>
          ))}
        </select>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.k}
                  onClick={() => {
                    if (sortCol === c.k) setSortDir(-sortDir);
                    else { setSortCol(c.k); setSortDir(-1); }
                  }}
                  className={sortCol === c.k ? "sorted" : ""}
                >
                  {c.label}
                  {sortCol === c.k ? (sortDir > 0 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((x: any) => (
              <tr
                key={x.abbr}
                className="click"
                onClick={() => setSelTeam(x.abbr)}
                style={{ cursor: "pointer" }}
              >
                {cols.map((c) => (
                  <td key={c.k} dangerouslySetInnerHTML={{ __html: cell(x, c.k) }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {t && (
        <div>
          <h3>
            {t.name}: defense vs position
          </h3>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  {["pts", "reb", "ast", "fg3", "pra"].map((k) => (
                    <th key={k}>{MS[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["G", "W", "C"].map((p) => (
                  <tr key={p}>
                    <td>
                      <b>{p}</b>
                    </td>
                    {["pts", "reb", "ast", "fg3", "pra"].map((k) => {
                      const r = t.rank[p]?.[k] || 15;
                      const dm = t.dm[p]?.[k] || 1;
                      return (
                        <td key={k}>
                          <span
                            className={`chip ${r >= 21 ? "soft" : r <= 10 ? "tough" : "mid"}`}
                            title="1st = toughest defense"
                          >
                            {ord(r)}
                          </span>{" "}
                          <small style={{ color: "var(--mut)" }}>
                            {(dm * 100 - 100 >= 0 ? "+" : "") +
                              (dm * 100 - 100).toFixed(1)}
                            %
                          </small>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Percentages show how much the team allows vs league average.
          </p>

          <h3>Players</h3>
          <div>
            {state.PLAYERS.filter((p) => p.team === t.abbr).map((p) => (
              <button
                key={p.id}
                className="b alt sm"
                onClick={() => {}}
                style={{ margin: 2 }}
              >
                {p.name}
              </button>
            ))}
            {state.PLAYERS.filter((p) => p.team === t.abbr).length === 0 && (
              <span className="note">No tracked players.</span>
            )}
          </div>

          {inj && inj.length > 0 && (
            <div>
              <h3>
                Injury Report{" "}
                <span className="tag bad">{inj.length} player{inj.length === 1 ? "" : "s"}</span>
              </h3>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Pos</th>
                      <th>Status</th>
                      <th>Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inj.map((p: any, i: number) => (
                      <tr key={i}>
                        <td>{p.name}</td>
                        <td>{p.pos}</td>
                        <td>
                          <span className={`tag ${p.status === "Day-To-Day" ? "warn" : "bad"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>{p.return}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {inj[0]?.note && (
                <p className="note">{inj[0].note.slice(0, 80)}...</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}