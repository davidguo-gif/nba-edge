// One-off/fallback: replace "prev" in public/nbadata.json with the FULL previous regular season
// (player box scores), so prop hit rates can be shown for last season too.
// The daily Python fetch writes the same thing.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "nbadata.json");
const H = { "User-Agent": "Mozilla/5.0", Referer: "https://www.nba.com/", Origin: "https://www.nba.com" };
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const start = Number(data.season.slice(0, 4)) - 1;
const prev = `${start}-${String((start + 1) % 100).padStart(2, "0")}`;

const u = `https://stats.nba.com/stats/leaguegamelog?Counter=0&DateFrom=&DateTo=&Direction=ASC&LeagueID=00&PlayerOrTeam=P&Season=${prev}&SeasonType=Regular+Season&Sorter=DATE`;
const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(120000) });
const rs = (await r.json()).resultSets[0];
const rows = [];
let added = 0;
for (const row of rs.rowSet) {
  const o = Object.fromEntries(rs.headers.map((h, i) => [h, row[i]]));
  if (!o.MIN) continue;
  const m = o.MATCHUP.split(" ");
  const pid = o.PLAYER_ID;
  if (!data.pl[pid]) { data.pl[pid] = [o.PLAYER_NAME, ""]; added++; }
  rows.push([`${o.GAME_ID}_${pid}`, o.GAME_ID, o.GAME_DATE.slice(0, 10), o.TEAM_ABBREVIATION, m[m.length - 1],
    o.MATCHUP.includes("vs.") ? 1 : 0, pid, Number(o.MIN), o.PTS || 0, o.REB || 0, o.AST || 0, o.FG3M || 0,
    o.FGA || 0, o.FTA || 0, o.OREB || 0, o.TOV || 0]);
}
data.prev = rows;
fs.writeFileSync(FILE, JSON.stringify(data));
console.log(prev, "rows:", rows.length, "new players:", added, "file MB:", (fs.statSync(FILE).size / 1e6).toFixed(1));
