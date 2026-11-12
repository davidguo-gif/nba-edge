"use client";

import { useNBA } from "@/lib/NBAContext";
import { Nav } from "./Nav";
import { SlateTab } from "./SlateTab";
import { PropsTab } from "./PropsTab";
import { ParlayTab } from "./ParlayTab";
import { PlayersTab } from "./PlayersTab";
import { TeamsTab } from "./TeamsTab";
import { SystemsTab } from "./SystemsTab";
import { TrackerTab } from "./TrackerTab";
import { DataTab } from "./DataTab";
import { PropDetailView } from "./PropDetailView";
import { TIME_OPTIONS } from "@/lib/nba";

export function AppShell() {
  const { loading, error, activeTab, refresh, oddsFormat, setOddsFormat, propDetail, timeHorizon, setTimeHorizon } = useNBA();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "var(--mut)" }}>
        <div className="text-center">
          <div className="text-2xl mb-2">🏀</div>
          <div className="text-sm">Loading NBA data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "var(--mut)" }}>
        <div className="text-center max-w-md">
          <div className="text-2xl mb-2">⚠</div>
          <div className="text-sm mb-2" style={{ color: "var(--red)" }}>{error}</div>
          <div className="text-xs mb-4">
            Run <code>python fetch_nba_data.py</code> from the nba-edge folder, then reload.
          </div>
          <button className="b" onClick={refresh}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 16px" }}>
      <header className="app-header">
        <div style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 20 }}>🏀</span>
          <span style={{ background: "linear-gradient(135deg, #e8eaf6 40%, #00e5ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>NBA Edge</span>
          <span style={{ fontSize: 9, color: "var(--mut)", fontWeight: 400, marginLeft: 2 }}>v2</span>
        </div>
        <Nav />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap", cursor: "pointer" }}>
            <span>⏰ <b style={{ color: "var(--blue)" }}>{TIME_OPTIONS.find((o) => o.value === timeHorizon)?.label || `${Math.round(timeHorizon / 24)}d`}</b></span>
            <input
              type="range"
              min={0}
              max={TIME_OPTIONS.length - 1}
              step={1}
              value={Math.max(0, TIME_OPTIONS.findIndex((o) => o.value === timeHorizon))}
              onChange={(e) => setTimeHorizon(TIME_OPTIONS[+e.target.value].value)}
              style={{ width: 72, verticalAlign: "middle" }}
              title="Time horizon for Slate, Props & Parlay"
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
            Odds
            <select
              value={oddsFormat}
              onChange={(e) => setOddsFormat(e.target.value as "decimal" | "american")}
              style={{ fontSize: 11, padding: "3px 6px" }}
            >
              <option value="decimal">Decimal</option>
              <option value="american">American</option>
            </select>
          </label>
        </div>
      </header>
      {propDetail == null && (
        <>
          <div style={{ display: activeTab === "slate" ? "block" : "none" }}>
            <SlateTab />
          </div>
          <div style={{ display: activeTab === "props" ? "block" : "none" }}>
            <PropsTab />
          </div>
          <div style={{ display: activeTab === "parlay" ? "block" : "none" }}>
            <ParlayTab />
          </div>
          <div style={{ display: activeTab === "players" ? "block" : "none" }}>
            <PlayersTab />
          </div>
          <div style={{ display: activeTab === "teams" ? "block" : "none" }}>
            <TeamsTab />
          </div>
          <div style={{ display: activeTab === "systems" ? "block" : "none" }}>
            <SystemsTab />
          </div>
          <div style={{ display: activeTab === "tracker" ? "block" : "none" }}>
            <TrackerTab />
          </div>
          <div style={{ display: activeTab === "data" ? "block" : "none" }}>
            <DataTab />
          </div>
        </>
      )}

      {propDetail != null && (
        <div style={{ paddingTop: 8 }}>
          <PropDetailView />
        </div>
      )}
    </div>
  );
}