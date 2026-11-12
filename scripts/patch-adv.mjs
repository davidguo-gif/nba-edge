// One-off/fallback: add official NBA.com advanced team numbers ("adv") to public/nbadata.json
// without re-pulling every box score. The daily Python fetch writes the same field.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "nbadata.json");
const H = { "User-Agent": "Mozilla/5.0", Referer: "https://www.nba.com/", Origin: "https://www.nba.com" };
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const season = data.season;

const get = async (u) => (await (await fetch(u, { headers: H, signal: AbortSignal.timeout(60000) })).json()).resultSets[0];
const objs = (rs) => rs.rowSet.map((r) => Object.fromEntries(rs.headers.map((h, i) => [h, r[i]])));

const log = objs(await get(
  `https://stats.nba.com/stats/leaguegamelog?Counter=0&DateFrom=&DateTo=&Direction=ASC&LeagueID=00&PlayerOrTeam=T&Season=${season}&SeasonType=Regular+Season&Sorter=DATE`));
const abbr = Object.fromEntries(log.map((r) => [r.TEAM_ID, r.TEAM_ABBREVIATION]));
const adv = objs(await get(
  `https://stats.nba.com/stats/leaguedashteamstats?MeasureType=Advanced&PerMode=PerGame&Season=${season}&SeasonType=Regular+Season&LeagueID=00&Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&LastNGames=0&Location=&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&SeasonSegment=&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`));
data.adv = Object.fromEntries(
  adv.filter((o) => abbr[o.TEAM_ID]).map((o) => [abbr[o.TEAM_ID], { pace: o.PACE, ortg: o.OFF_RATING, drtg: o.DEF_RATING, net: o.NET_RATING }]),
);
fs.writeFileSync(FILE, JSON.stringify(data));
console.log("adv teams:", Object.keys(data.adv).length, data.adv.OKC);
