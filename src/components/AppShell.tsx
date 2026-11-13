"use client";

import { useNBA } from "@/lib/NBAContext";
import { Nav } from "./Nav";
import { SlateTab } from "./SlateTab";
import { PropsTab } from "./PropsTab";
import { ParlayTab } from "./ParlayTab";
import { PlayersTab } from "./PlayersTab";
import { TeamsTab } from "./TeamsTab";
import { SystemsTab } from "./SystemsTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { TrackerTab } from "./TrackerTab";
import { DataTab } from "./DataTab";
import { PropDetailView } from "./PropDetailView";

export function AppShell() {
  const { loading, error, activeTab, refresh, oddsFormat, setOddsFormat, propDetail, selectedDate, setSelectedDate } = useNBA();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: "var(--mut)" }}>
        <div className="text-center">
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
        <div className="brand">
          <span>D Pics</span>
        </div>
        <Nav />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <label style={{ fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              title="Pick any date to see its bets and results"
              style={{ fontSize: 12, padding: "3px 8px", width: 140 }}
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
          <div style={{ display: activeTab === "analytics" ? "block" : "none" }}>
            <AnalyticsTab />
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