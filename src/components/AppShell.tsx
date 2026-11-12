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

export function AppShell() {
  const { loading, error, activeTab, refresh } = useNBA();

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
    <div className="min-h-screen p-3" style={{ maxWidth: 1400, margin: "0 auto" }}>
      <header
        className="flex items-center gap-3 mb-3 pb-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="text-lg font-semibold">
          🏀 NBA <b>Edge</b>
        </div>
        <Nav />
      </header>
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
    </div>
  );
}