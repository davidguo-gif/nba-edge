// Builds public/seasons.json: full regular-season team stats for previous seasons, one block per season.
// Past seasons never change, so seasons already in the file are skipped.
//   node scripts/fetch-seasons.mjs [numberOfPreviousSeasons=5]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "seasons.json");
const COUNT = Number(process.argv[2]) || 5;

const today = new Date();
const startYear = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1; // Sep+ = new season
const seasonStr = (y) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
const dayNum = (d) => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);

async function teamLog(season) {
  const u =
    "https://stats.nba.com/stats/leaguegamelog?Counter=0&DateFrom=&DateTo=&Direction=ASC&LeagueID=00&PlayerOrTeam=T" +
    `&Season=${season}&SeasonType=Regular+Season&Sorter=DATE`;
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.nba.com/", Origin: "https://www.nba.com" },
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const rs = (await r.json()).resultSets[0];
      return rs.rowSet.map((row) => Object.fromEntries(rs.headers.map((h, j) => [h, row[j]])));
    } catch (e) {
      console.log(`  ${season} attempt ${i} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
  throw new Error(`could not fetch ${season}`);
}

function computeSeason(rows) {
  const byGame = {};
  rows.forEach((r) => (byGame[r.GAME_ID] ||= []).push(r));
  const games = {};
  rows.forEach((r) => {
    const o = (byGame[r.GAME_ID] || []).find((x) => x.TEAM_ABBREVIATION !== r.TEAM_ABBREVIATION);
    if (!o) return;
    const poss =
      (r.FGA + 0.44 * r.FTA - r.OREB + r.TOV + (o.FGA + 0.44 * o.FTA - o.OREB + o.TOV)) / 2;
    (games[r.TEAM_ABBREVIATION] ||= []).push({
      date: r.GAME_DATE.slice(0, 10),
      home: r.MATCHUP.includes("vs.") ? 1 : 0,
      pts: r.PTS,
      opp: o.PTS,
      poss,
      gm: r.MIN / 5,
    });
  });

  const out = {};
  for (const [ab, g] of Object.entries(games)) {
    g.sort((a, b) => (a.date < b.date ? -1 : 1));
    const sum = (k) => g.reduce((s, x) => s + x[k], 0);
    const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const poss = sum("poss"), gm = sum("gm");
    const wins = g.filter((x) => x.pts > x.opp).length;
    const bm = [], nm = [];
    let b2bW = 0, b2bL = 0, streak = 0;
    g.forEach((x, i) => {
      const mg = x.pts - x.opp;
      if (i > 0 && dayNum(x.date) - dayNum(g[i - 1].date) === 1) {
        bm.push(mg);
        mg > 0 ? b2bW++ : b2bL++;
      } else nm.push(mg);
    });
    for (let i = g.length - 1; i >= 0; i--) {
      const w = g[i].pts > g[i].opp;
      if (i === g.length - 1) streak = w ? 1 : -1;
      else if (streak > 0 === w) streak += streak > 0 ? 1 : -1;
      else break;
    }
    const hr = (flag) => {
      const h = g.filter((x) => x.home === flag);
      const w = h.filter((x) => x.pts > x.opp).length;
      return `${w}-${h.length - w}`;
    };
    const l10 = g.slice(-10);
    const l10w = l10.filter((x) => x.pts > x.opp).length;
    const ortg = (100 * sum("pts")) / poss, drtg = (100 * sum("opp")) / poss;
    out[ab] = {
      w: wins,
      l: g.length - wins,
      gp: g.length,
      pace: (poss * 48) / gm,
      ortg,
      drtg,
      net: ortg - drtg,
      ppg: sum("pts") / g.length,
      oppg: sum("opp") / g.length,
      l10: `${l10w}-${l10.length - l10w}`,
      streak: (streak > 0 ? "W" : "L") + Math.abs(streak),
      b2bW,
      b2bL,
      b2bDrop: +(mean(nm) - mean(bm)).toFixed(1),
      home: hr(1),
      road: hr(0),
    };
  }
  return out;
}

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
for (let k = 1; k <= COUNT; k++) {
  const season = seasonStr(startYear - k);
  if (existing[season]) {
    console.log(`${season}: already have it`);
    continue;
  }
  console.log(`${season}: fetching...`);
  existing[season] = computeSeason(await teamLog(season));
  console.log(`${season}: ${Object.keys(existing[season]).length} teams`);
  await new Promise((r) => setTimeout(r, 1500));
}
const sorted = Object.fromEntries(Object.entries(existing).sort((a, b) => (a[0] < b[0] ? 1 : -1)));
fs.writeFileSync(OUT, JSON.stringify(sorted));
console.log("Wrote", OUT);
