"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Player, Bet, Injury, ParlayLeg } from "@/types";
import { createState, fetchNBAData, processData, clearCache } from "@/lib/nba";
import type { AppState, OddsPayload } from "@/lib/nba";
import { store, save } from "@/lib/store";
import type { OddsFormat } from "@/lib/odds";

interface NBAContextType {
  state: AppState;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  applyOdds: (odds: OddsPayload) => Promise<void>;
  oddsFormat: OddsFormat;
  setOddsFormat: (f: OddsFormat) => void;
  parlay: ParlayLeg[];
  addLeg: (leg: ParlayLeg) => void;
  setLegs: (legs: ParlayLeg[]) => void;
  updateLegOdds: (id: string, odds: number) => void;
  removeLeg: (id: string) => void;
  bets: Bet[];
  addBet: (desc: string, book: string, odds: number, units: number) => void;
  updateBetResult: (id: number | string, result: "pending" | "win" | "loss" | "push") => void;
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
  const [activeTab, setActiveTab] = useState("slate");
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
  }, [refresh]);

  const addBet = useCallback(
    (desc: string, book: string, odds: number, units: number) => {
      const newBet: Bet = {
        id: Date.now() + Math.random(),
        date: new Date().toISOString().slice(0, 10),
        desc,
        book,
        odds,
        units,
        result: "pending",
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
        removeBet,
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