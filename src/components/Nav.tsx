"use client";

import { useNBA } from "@/lib/NBAContext";

const TABS = [
  { id: "slate", label: "Slate" },
  { id: "props", label: "Props" },
  { id: "parlay", label: "Parlay" },
  { id: "players", label: "Players" },
  { id: "teams", label: "Teams" },
  { id: "analytics", label: "Analytics" },
  { id: "systems", label: "Systems" },
  { id: "tracker", label: "Tracker" },
  { id: "data", label: "Data" },
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
          {t.label}
        </button>
      ))}
    </nav>
  );
}