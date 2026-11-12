"use client";

import { useNBA } from "@/lib/NBAContext";

const TABS = [
  { id: "slate", label: "Slate" },
  { id: "props", label: "Props" },
  { id: "parlay", label: "Parlay Builder" },
  { id: "players", label: "Players" },
  { id: "teams", label: "Teams" },
  { id: "systems", label: "Systems & Tools" },
  { id: "tracker", label: "Bet Tracker" },
  { id: "data", label: "Data Sources" },
];

export function Nav() {
  const { activeTab, setActiveTab } = useNBA();
  return (
    <nav className="flex gap-1 flex-wrap">
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