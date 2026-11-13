"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { Bet, ParlayLeg, PickRecord } from "@/types";
import { createState, fetchNBAData, processData, clearCache, etDate, todayET, normName } from "@/lib/nba";
import { annotateProps, gradeAgainstLog } from "@/lib/analysis";
import type { AppState, OddsPayload } from "@/lib/nba";
import { store, save } from "@/lib/store";
import type { OddsFormat } from "@/lib/odds";

interface NBAContextType {
  state: AppState;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  applyOdds: (odds: OddsPayload) => Promise<void>;
  focus: { tab: string; player?: string; market?: string; gameId?: number | null } | null;
  goToLeg: (leg: ParlayLeg) => void;
  clearFocus: () => void;
  propDetail: number | null;
  setPropDetail: (id: number | null) => void;
  oddsFormat: OddsFormat;
  setOddsFormat: (f: OddsFormat) => void;
  parlay: ParlayLeg[];
  addLeg: (leg: ParlayLeg) => void;
  setLegs: (legs: ParlayLeg[]) => void;
  updateLegOdds: (id: string, odds: number) => void;
  removeLeg: (id: string) => void;
  bets: Bet[];
  addBet: (desc: string, book: string, odds: number, units: number, note?: string, pick?: Bet["pick"]) => void;
  updateBetResult: (id: number | string, result: "pending" | "win" | "loss" | "push") => void;
  updateBetNote: (id: number | string, note: string) => void;
  removeBet: (id: number | string) => void;
  bankroll: number;
  setBankroll: (v: number) => void;
  unitPct: number;
  setUnitPct: (v: number) => void;
  activeTab: string;
  setActiveTab: (t: string) => void;
  selTeam: string | null;
  setSelTeam: (t: string | null) => void;
  selPlayer: number | null;
  setSelPlayer: (p: number | null) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  dateOptions: { value: string; label: string }[];
  history: PickRecord[];
}

const NBAContext = createContext<NBAContextType | null>(null);

export function useNBA() {
  const ctx = useContext(NBAContext);
  if (!ctx) throw new Error("useNBA must be used within NBAProvider");
  return ctx;
}

export function NBAProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(createState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [parlay, setParlay] = useState<ParlayLeg[]>([]);
  const [focus, setFocus] = useState<NBAContextType["focus"]>(null);
  const clearFocus = useCallback(() => setFocus(null), []);
  const [propDetail, setPropDetail] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayET);
  const [history, setHistory] = useState<PickRecord[]>([]);
  // jump from a parlay leg to the prop (Props tab) or game (Slate tab) it came from
  const goToLeg = useCallback((leg: ParlayLeg) => {
    const isProp = leg.kind === "prop";
    setActiveTabState(isProp ? "props" : "slate");
    setSelTeam(null);
    setSelPlayer(null);
    setFocus({ tab: isProp ? "props" : "slate", player: leg.player, market: leg.market, gameId: leg.gameId });
  }, []);
  const [oddsFormat, setOddsFormatState] = useState<OddsFormat>("decimal");
  const setOddsFormat = useCallback((f: OddsFormat) => {
    setOddsFormatState(f);
    save("oddsfmt", f);
  }, []);
  const setLegs = useCallback((legs: ParlayLeg[]) => {
    setParlay(legs);
    save("parlay", legs);
  }, []);
  const addLeg = useCallback(
    (leg: ParlayLeg) => {
      setParlay((cur) => {
        const next = cur.some((l) => l.id === leg.id) ? cur : [...cur, leg];
        save("parlay", next);
        return next;
      });
    },
    [],
  );
  const updateLegOdds = useCallback((id: string, odds: number) => {
    setParlay((cur) => {
      const next = cur.map((l) => (l.id === id ? { ...l, odds } : l));
      save("parlay", next);
      return next;
    });
  }, []);
  const removeLeg = useCallback((id: string) => {
    setParlay((cur) => {
      const next = cur.filter((l) => l.id !== id);
      save("parlay", next);
      return next;
    });
  }, []);
  const [bankroll, setBankroll] = useState(1000);
  const [unitPct, setUnitPct] = useState(1);
  const [activeTab, setActiveTabState] = useState("slate");
  const setActiveTab = setActiveTabState;
  const [selTeam, setSelTeam] = useState<string | null>(null);
  const [selPlayer, setSelPlayer] = useState<number | null>(null);

  const loadOdds = (): OddsPayload | null => {
    try {
      const o = JSON.parse(localStorage.getItem("nbaedge.odds") || "null");
      return o && Date.now() - o.ts < 24 * 3600e3 ? o : null;
    } catch {
      return null;
    }
  };

  const applyOdds = useCallback(async (odds: OddsPayload) => {
    localStorage.setItem("nbaedge.odds", JSON.stringify(odds));
    const data = await fetchNBAData();
    const s = createState();
    processData(data, s, odds);
    annotateProps(s);
    setState(s);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      clearCache();
      const data = await fetchNBAData();
      const s = createState();
      processData(data, s, loadOdds());
      annotateProps(s);
      setState(s);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    setBets(store<Bet[]>("bets", []));
    setParlay(store<ParlayLeg[]>("parlay", []));
    setOddsFormatState(store<OddsFormat>("oddsfmt", "decimal"));
    setBankroll(store<number>("bank", 1000));
    setUnitPct(store<number>("unitpct", 1));
    setHistory(store<PickRecord[]>("history", []));
  }, [refresh]);

  // Save every playable pick (+EV vs the sharp consensus) before tip-off so past days can be reviewed.
  useEffect(() => {
    const now = Date.now();
    const fresh: PickRecord[] = [];
    state.PROPS.forEach((p) => {
      const a = p._analysis;
      const pl = state.PLAYERS[p.pid];
      const gm = state.SLATE[p.gid];
      if (!a || !pl || !gm || a.noSharp || a.best.ev < 0.03 || /^q\d_/.test(p.market)) return;
      if (gm.dt && new Date(gm.dt).getTime() <= now) return; // already tipped off: keep the saved pre-game pick
      fresh.push({
        key: `${p.date}|${normName(pl.name)}|${p.market}`,
        date: p.date,
        player: pl.name,
        team: pl.team,
        opp: p.opp,
        market: p.market,
        line: a.best.line,
        side: a.best.side,
        book: a.best.book,
        odds: a.best.odds,
        ev: a.best.ev,
        grade: a.rating.grade,
        score: a.rating.score,
        conf: a.conf,
        result: "pending",
        ts: now,
      });
    });
    if (!fresh.length) return;
    setHistory((cur) => {
      const map = new Map(cur.map((r) => [r.key, r]));
      fresh.forEach((r) => {
        const old = map.get(r.key);
        if (!old || old.result === "pending") map.set(r.key, r);
      });
      const next = [...map.values()];
      save("history", next);
      return next;
    });
  }, [state]);

  // Grade saved picks and tracked prop bets from the box scores once the game is in the data.
  useEffect(() => {
    if (!state.PLAYERS.length) return;
    const byKey = new Map(state.PLAYERS.map((p) => [`${normName(p.name)}|${p.team}`, p]));
    const byName = new Map(state.PLAYERS.map((p) => [normName(p.name), p]));
    setHistory((cur) => {
      let changed = false;
      const next = cur.map((r) => {
        if (r.result !== "pending") return r;
        const g = gradeAgainstLog(byKey.get(`${normName(r.player)}|${r.team}`), r.date, r.market, r.line, r.side);
        if (!g) return r;
        changed = true;
        return { ...r, result: g.result, actual: g.actual };
      });
      if (changed) save("history", next);
      return changed ? next : cur;
    });
    setBets((cur) => {
      let changed = false;
      const next = cur.map((b) => {
        if (b.result !== "pending" || !b.pick) return b;
        const g = gradeAgainstLog(byName.get(normName(b.pick.player)), b.pick.date, b.pick.market, b.pick.line, b.pick.side);
        if (!g) return b;
        changed = true;
        return { ...b, result: g.result, actual: g.actual };
      });
      if (changed) save("bets", next);
      return changed ? next : cur;
    });
  }, [state.PLAYERS, history, bets]);

  const dateOptions = useMemo(() => {
    const today = todayET();
    const tomorrow = etDate(Date.now() + 864e5);
    const dates = new Set<string>([today]);
    state.SLATE.forEach((g) => g.date && dates.add(g.date));
    state.PROPS.forEach((p) => dates.add(p.date));
    history.forEach((r) => dates.add(r.date));
    return [...dates]
      .sort((a, b) => (a < b ? 1 : -1))
      .map((d) => {
        const pretty = new Date(d + "T12:00:00Z").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
        if (d >= today) return { value: d, label: `${d === today ? "Today" : d === tomorrow ? "Tomorrow" : "Upcoming"} · ${pretty}` };
        const day = history.filter((r) => r.date === d);
        const w = day.filter((r) => r.result === "win").length;
        const l = day.filter((r) => r.result === "loss").length;
        return { value: d, label: `${pretty} · ${day.length ? `${w}-${l}` : "no picks saved"}` };
      });
  }, [state.SLATE, state.PROPS, history]);

  const addBet = useCallback(
    (desc: string, book: string, odds: number, units: number, note?: string, pick?: Bet["pick"]) => {
      const newBet: Bet = {
        id: Date.now() + Math.random(),
        date: new Date().toISOString(),
        desc,
        book,
        odds,
        units,
        result: "pending",
        note,
        pick,
      };
      const next = [...bets, newBet];
      setBets(next);
      save("bets", next);
    },
    [bets],
  );

  const updateBetResult = useCallback(
    (id: number | string, result: "pending" | "win" | "loss" | "push") => {
      const next = bets.map((b) =>
        String(b.id) === String(id) ? { ...b, result } : b,
      );
      setBets(next);
      save("bets", next);
    },
    [bets],
  );

  const updateBetNote = useCallback(
    (id: number | string, note: string) => {
      const next = bets.map((b) => (String(b.id) === String(id) ? { ...b, note } : b));
      setBets(next);
      save("bets", next);
    },
    [bets],
  );
  const removeBet = useCallback(
    (id: number | string) => {
      const next = bets.filter((b) => String(b.id) !== String(id));
      setBets(next);
      save("bets", next);
    },
    [bets],
  );

  return (
    <NBAContext.Provider
      value={{
        state,
        loading,
        error,
        refresh,
        applyOdds,
        focus,
        goToLeg,
        clearFocus,
        propDetail,
        setPropDetail,
        oddsFormat,
        setOddsFormat,
        parlay,
        addLeg,
        setLegs,
        updateLegOdds,
        removeLeg,
        bets,
        addBet,
        updateBetResult,
        updateBetNote,
        removeBet,
        selectedDate,
        setSelectedDate,
        dateOptions,
        history,
        bankroll,
        setBankroll: (v) => { setBankroll(v); save("bank", v); },
        unitPct,
        setUnitPct: (v) => { setUnitPct(v); save("unitpct", v); },
        activeTab,
        setActiveTab: (t) => { setActiveTab(t); setSelTeam(null); setSelPlayer(null); },
        selTeam,
        setSelTeam,
        selPlayer,
        setSelPlayer,
      }}
    >
      {children}
    </NBAContext.Provider>
  );
}