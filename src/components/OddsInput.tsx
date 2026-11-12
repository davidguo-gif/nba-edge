"use client";

import { useEffect, useRef, useState } from "react";
import { useNBA } from "@/lib/NBAContext";
import { fmtOdds, parseOdds } from "@/lib/odds";

/** Odds field that shows and accepts the user's chosen format; value is American. */
export function OddsInput({
  american,
  onChange,
  style,
}: {
  american: number;
  onChange: (a: number) => void;
  style?: React.CSSProperties;
}) {
  const { oddsFormat } = useNBA();
  const [text, setText] = useState(fmtOdds(american, oddsFormat));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(fmtOdds(american, oddsFormat));
  }, [american, oddsFormat]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      style={{ width: 80, ...style }}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(fmtOdds(american, oddsFormat));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const a = parseOdds(e.target.value, oddsFormat);
        if (a != null) onChange(a);
      }}
    />
  );
}
