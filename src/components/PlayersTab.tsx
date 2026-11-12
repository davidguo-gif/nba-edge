"use client";

import { useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { md } from "@/lib/nba";
import type { Player } from "@/types";

const MK: Record<string, string> = {
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  fg3: "3PM",
  pra: "PRA",
};

export function PlayersTab() {
  const { state } = useNBA();
  const { PLAYERS } = state;
  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState("all");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState(1);
  const [selPl, setSelPl] = useState<number | null>(null);

  const filtered: Player[] = PLAYERS.filter((p: Player) => {
    if (posFilter !== "all" && p.pos !== posFilter) return false;
    if (
      q &&
      !p.name.toLowerCase().includes(q.toLowerCase()) &&
      !p.team.toLowerCase().includes(q.toLowerCase())
    )
      return false;
    return true;
  }).sort((a: any, b: any) => {
    const av = a[sortCol],
      bv = b[sortCol];
    return (typeof av === "string" ? av.localeCompare(bv) : (av ?? 0) - (bv ?? 0)) * sortDir;
  });

  const pl = selPl != null ? PLAYERS[selPl] : null;

  return (
    <div>
      <h2>Players</h2>
      <p className="sub">
        Averages over all tracked games. Click a player for game log.
      </p>
      <div className="filters">
        <input
          placeholder="Search player or team..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 250 }}
        />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
        >
          <option value="all">All positions</option>
          <option value="G">Guards</option>
          <option value="W">Wings</option>
          <option value="C">Centers</option>
        </select>
        <span className="note">{filtered.length} players</span>
      </div>
      {!pl ? (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                {[
                  { k: "name", label: "Player" },
                  { k: "team", label: "Team" },
                  { k: "pos", label: "Pos" },
                  { k: "pts", label: "PTS" },
                  { k: "reb", label: "REB" },
                  { k: "ast", label: "AST" },
                  { k: "fg3", label: "3PM" },
                  { k: "min", label: "MIN" },
                ].map((c) => (
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
              {filtered.map((p: Player) => (
                <tr
                  key={p.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelPl(p.id)}
                >
                  <td>
                    <b>{p.name}</b>
                  </td>
                  <td>{p.team}</td>
                  <td>{p.pos}</td>
                  <td>{p.pts.toFixed(1)}</td>
                  <td>{p.reb.toFixed(1)}</td>
                  <td>{p.ast.toFixed(1)}</td>
                  <td>{p.fg3.toFixed(1)}</td>
                  <td>{p.min.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <button className="b alt sm" onClick={() => setSelPl(null)}>
            ← Back to all players
          </button>
          <div className="grid g4" style={{ margin: "12px 0" }}>
            <div className="card stat">
              <b>{pl.pts.toFixed(1)}</b>
              <span>PTS</span>
            </div>
            <div className="card stat">
              <b>{pl.reb.toFixed(1)}</b>
              <span>REB</span>
            </div>
            <div className="card stat">
              <b>{pl.ast.toFixed(1)}</b>
              <span>AST</span>
            </div>
            <div className="card stat">
              <b>{pl.min.toFixed(1)}</b>
              <span>MIN</span>
            </div>
          </div>
          <h3>
            Game Log{" "}
            <span className="note">Last 20 games</span>
          </h3>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opp</th>
                  <th>MIN</th>
                  <th>PTS</th>
                  <th>REB</th>
                  <th>AST</th>
                  <th>3PM</th>
                  <th>PRA</th>
                  <th>B2B</th>
                </tr>
              </thead>
              <tbody>
                {pl.log.slice(0, 20).map((g: { date: string; home: boolean; opp: string; min: number; pts: number; reb: number; ast: number; fg3: number; pra: number; b2b: boolean }, i: number) => (
                  <tr key={i}>
                    <td>{md(g.date)}</td>
                    <td>
                      {g.home ? "vs" : "@"} {g.opp}
                    </td>
                    <td>{g.min}</td>
                    <td>{g.pts}</td>
                    <td>{g.reb}</td>
                    <td>{g.ast}</td>
                    <td>{g.fg3}</td>
                    <td>{g.pra}</td>
                    <td>{g.b2b ? "⚠" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}