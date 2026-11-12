"use client";

import { useNBA } from "@/lib/NBAContext";

export function DataTab() {
  const { state, refresh } = useNBA();
  const sy = state.synced;

  return (
    <div>
      <h2>Data Sources</h2>
      <p className="sub">
        Everything runs through the Next.js server. Keys are stored in your browser.
      </p>
      <div className="grid g2">
        <div className="card">
          <b>1. Player &amp; team stats (nba_api)</b>
          <br />
          <span className="note">
            Fetched from stats.nba.com via Python script on the server.
          </span>
          <ol className="clean" style={{ marginTop: 8 }}>
            <li>
              Run <code>cd nba-edge-old &amp;&amp; python fetch_nba_data.py</code>
            </li>
            <li>
              Then <code>cd ../nba-edge-next &amp;&amp; node scripts/copy-data.mjs</code>
            </li>
            <li>Reload this page</li>
          </ol>
          {sy && (
            <div className="note" style={{ marginTop: 8 }}>
              {sy.games} games &middot; {sy.players} players &middot; through{" "}
              {sy.last} &middot; updated{" "}
              {new Date(sy.ts).toLocaleString()} (nba_api)
            </div>
          )}
          {!sy && (
            <div className="note" style={{ marginTop: 8 }}>
              No data loaded yet. Run update-data.bat, then reload.
            </div>
          )}
          <button className="b sm mt-2" onClick={refresh}>
            Reload data
          </button>
        </div>
        <div className="card">
          <b>2. Sportsbook odds (The Odds API)</b>
          {state.live ? (
            <span className="tag ok" style={{ marginLeft: 4 }}>
              REAL
            </span>
          ) : (
            <span className="tag warn" style={{ marginLeft: 4 }}>
              Demo
            </span>
          )}
          <p className="note">
            Enter your key in the Props tab to fetch live odds from{" "}
            <a
              href="https://the-odds-api.com"
              target="_blank"
              rel="noopener"
            >
              the-odds-api.com
            </a>
            .
          </p>
          <button
            className="b sm mt-2"
            onClick={() =>
              (document.querySelector('[data-tab="props"]') as HTMLElement)?.click()
            }
          >
            Go to Props
          </button>
        </div>
      </div>
      <h3>What is computed vs unavailable</h3>
      <div className="card">
        <ul className="clean">
          <li>
            <b>Real:</b> player logs (PTS/REB/AST/3PM/PRA/MIN), team W-L,
            pace, ORtg, DRtg, B2B record and margin drop, home/road, L10,
            streak, defense rank by position, tonight&apos;s games and rest days,
            sportsbook lines and prices, injury reports.
          </li>
          <li>
            <b>Not included:</b> ATS and over/under records (need historical
            odds), travel distance.
          </li>
          <li>
            Players with under 3 games or under 15 MPG are hidden until they
            play more; props for players not in the stats data are skipped.
          </li>
        </ul>
      </div>
    </div>
  );
}