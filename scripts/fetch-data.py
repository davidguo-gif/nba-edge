#!/usr/bin/env python3
"""Download real NBA data with the nba_api package (https://github.com/swar/nba_api) and write nbadata.js.

stats.nba.com blocks browser requests (no CORS), so the website can't call it directly. This script runs on
your computer, pulls the data, and writes nbadata.js next to index.html, which the site loads as a plain file.

    pip install nba_api
    python fetch_nba_data.py            # or double-click update-data.bat

Run it once a day (or whenever you want fresh numbers), then reload the site.
Pulled per run (about 4 requests):
  * LeagueGameLog (player level): every player's box score for the current season, plus last season's games
    dated 2026-01-01 or later, so the "2026 games" chart is complete early in a new season
  * PlayerIndex: position per player (used for defense-vs-position)
  * live ScoreBoard: today's games
  * ESPN injury report: each team's injured players with status and return date
"""
import json
import os
import re
import sys
import time
import urllib.request
import ssl
from datetime import datetime, timedelta, timezone

try:
    from nba_api.stats.endpoints import LeagueGameLog, PlayerIndex, LeagueDashTeamStats
    from nba_api.stats.static import teams as nba_teams
    from nba_api.live.nba.endpoints import scoreboard
except ImportError:
    sys.exit("nba_api is not installed. Run:  pip install nba_api")

import json
import os
import re
import sys
import time
import urllib.request
import ssl
from datetime import datetime, timedelta, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SCRIPT_DIR, "..", "public", "nbadata.json")
CUTOFF = "2026-01-01"
TIMEOUT = 60


def today_et():
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/New_York")).date()
    except Exception:  # tzdata missing on some Windows installs: approximate with UTC-5
        return (datetime.now(timezone.utc) - timedelta(hours=5)).date()


def season_str(start_year):
    return f"{start_year}-{(start_year + 1) % 100:02d}"


def call(label, fn, tries=4):
    """stats.nba.com is flaky and slow; retry with backoff."""
    for i in range(tries):
        try:
            print(f"  {label}...", flush=True)
            return fn()
        except Exception as e:  # noqa: BLE001
            wait = 5 * (i + 1)
            print(f"    failed ({type(e).__name__}: {str(e)[:120]}); retrying in {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"{label} failed after {tries} tries. stats.nba.com may be blocking your network (VPN/cloud IPs are often blocked).")


def result_set(d, name=None):
    sets = d["resultSets"]
    rs = next((s for s in sets if s["name"] == name), sets[0]) if name else sets[0]
    h = rs["headers"]
    return [dict(zip(h, r)) for r in rs["rowSet"]]


def game_rows(season, min_date=None):
    d = call(f"box scores {season}", lambda: LeagueGameLog(
        season=season, player_or_team_abbreviation="P", season_type_all_star="Regular Season", timeout=TIMEOUT).get_dict())
    rows, names = [], {}
    for r in result_set(d):
        date = r["GAME_DATE"][:10]
        if min_date and date < min_date:
            continue
        if not r.get("MIN"):  # DNP
            continue
        m = r["MATCHUP"].split()
        home = 1 if "vs." in m else 0
        pid = r["PLAYER_ID"]
        names[pid] = r["PLAYER_NAME"]
        # [0 id, 1 gameId, 2 date, 3 team, 4 opp, 5 home, 6 playerId, 7 min, 8 pts, 9 reb, 10 ast, 11 fg3, 12 fga, 13 fta, 14 oreb, 15 tov, 16 stl, 17 blk]
        rows.append([f"{r['GAME_ID']}_{pid}", r["GAME_ID"], date, r["TEAM_ABBREVIATION"], m[-1], home, pid, float(r["MIN"]),
                     r["PTS"] or 0, r["REB"] or 0, r["AST"] or 0, r["FG3M"] or 0, r["FGA"] or 0, r["FTA"] or 0, r["OREB"] or 0, r["TOV"] or 0, r["STL"] or 0, r["BLK"] or 0])
    time.sleep(1)
    return rows, names


def fetch_espn_injuries():
    """Scrape ESPN NBA injury report for each team."""
    team_name_to_abbr = {
        'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
        'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
        'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
        'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
        'LA Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM',
        'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN',
        'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK',
        'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL',
        'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX',
        'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC',
        'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR',
        'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
    }
    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(
        'https://www.espn.com/nba/injuries',
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=15)
        html = resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  ESPN injury fetch failed ({e})")
        return {}

    pattern = r'title="([^"]*?)"[^>]*/><span class="injuries__teamName[^>]*>([^<]+)</span>.*?<table[^>]*>(.*?)</table>'
    matches = re.findall(pattern, html, re.DOTALL)

    injuries = {}
    for title_name, span_name, table_html in matches:
        team_name = title_name or span_name.strip()
        abbr = team_name_to_abbr.get(team_name)
        if not abbr:
            continue

        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL)
        players = []
        for r in rows:
            cols = re.findall(r'<td[^>]*>(.*?)</td>', r, re.DOTALL)
            if len(cols) >= 5:
                texts = [re.sub(r'<[^>]+>', '', c).strip() for c in cols[:5]]
                if texts[0] not in ('NAME', ''):
                    note = re.sub(r'<[^>]+>', '', cols[4]).strip()
                    players.append({
                        'name': texts[0], 'pos': texts[1],
                        'return': texts[2], 'status': texts[3], 'note': note
                    })
        if players:
            injuries[abbr] = players

    total = sum(len(v) for v in injuries.values())
    print(f"  ESPN injuries: {total} players across {len(injuries)} teams")
    return injuries


def main():
    today = today_et()
    start_year = today.year if today.month >= 9 else today.year - 1
    season, prev = season_str(start_year), season_str(start_year - 1)
    print(f"Season {season} (today {today})")

    injuries = fetch_espn_injuries()

    rows, names = game_rows(season)
    prev_rows, prev_names = ([], {})
    prev_rows, prev_names = game_rows(prev)  # full previous season (prop hit rates, defense vs position)
    names = {**prev_names, **names}
    if not rows and not prev_rows:
        sys.exit("No box scores returned (season may not have started yet).")

    pos = {}
    try:
        idx = call("player positions", lambda: PlayerIndex(season=season, timeout=TIMEOUT).get_dict())
        pos = {r["PERSON_ID"]: (r.get("POSITION") or "") for r in result_set(idx)}
    except Exception as e:  # noqa: BLE001
        print(f"  positions unavailable ({e}); players default to wing")
    pl = {str(pid): [name, pos.get(pid, "")] for pid, name in names.items()}

    slate = {"date": str(today), "games": []}
    try:
        sb = call("today's games", lambda: scoreboard.ScoreBoard().get_dict()["scoreboard"])
        slate["date"] = sb.get("gameDate", str(today))
        for g in sb["games"]:
            slate["games"].append({"home": g["homeTeam"]["teamTricode"], "away": g["awayTeam"]["teamTricode"],
                                   "dt": g.get("gameTimeUTC"), "status": g.get("gameStatusText", "")})
    except Exception as e:  # noqa: BLE001
        print(f"  schedule unavailable ({e}); Slate tab will be empty")

    adv = {}
    try:  # official NBA.com pace / ratings
        ab = {t["id"]: t["abbreviation"] for t in nba_teams.get_teams()}
        d = call("official advanced team stats", lambda: LeagueDashTeamStats(
            season=season, measure_type_detailed_defense="Advanced", per_mode_detailed="PerGame", timeout=TIMEOUT).get_dict())
        for r in result_set(d):
            if r["TEAM_ID"] in ab:
                adv[ab[r["TEAM_ID"]]] = {"pace": r["PACE"], "ortg": r["OFF_RATING"], "drtg": r["DEF_RATING"], "net": r["NET_RATING"]}
    except Exception as e:  # noqa: BLE001
        print(f"  official advanced stats unavailable ({e}); falling back to box-score estimates")

    data = {"generated": datetime.now(timezone.utc).isoformat(), "season": season, "source": "nba_api",
            "rows": rows, "prev": prev_rows, "pl": pl, "slate": slate, "injuries": injuries, "adv": adv}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    last = max((r[2] for r in rows), default="n/a")
    print(f"Wrote {OUT}\n  {len(rows)} box scores through {last}, {len(prev_rows)} from {prev} (2026), "
          f"{len(pl)} players, {len(slate['games'])} games today")


if __name__ == "__main__":
    main()