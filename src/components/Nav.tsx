"use client";

import { useNBA } from "@/lib/NBAContext";

const TABS = [
  { id: "slate", label: "Slate", icon: "📋" },
  { id: "props", label: "Props", icon: "🎯" },
  { id: "parlay", label: "Parlay", icon: "🔗" },
  { id: "players", label: "Players", icon: "👤" },
  { id: "teams", label: "Teams", icon: "🏟️" },
  { id: "systems", label: "Systems", icon: "⚡" },
  { id: "tracker", label: "Tracker", icon: "📊" },
  { id: "data", label: "Data", icon: "📡" },
];

export function Nav() {
  const { activeTab, setActiveTab } = useNBA();
  return (
    <nav style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`nav-btn${activeTab === t.id ? " on" : ""}`}
          onClick={() => setActiveTab(t.id)}
        >
          <span style={{ marginRight: 4 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}