"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Number field you can fully clear and retype (a plain controlled number input snaps back to 0).
 * onChange only fires for valid numbers; blur restores the last valid value if left empty.
 */
export function NumInput({
  value,
  onChange,
  min,
  step,
  style,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number | string;
  style?: React.CSSProperties;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      value={text}
      style={style}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(String(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!isNaN(n) && (min == null || n >= min)) onChange(n);
      }}
    />
  );
}
