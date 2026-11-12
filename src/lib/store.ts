"use client";

const PREFIX = "nbaedge.";

export function store<T>(key: string, fallback?: T): T {
  if (typeof window === "undefined") return fallback ?? (undefined as unknown as T);
  try {
    const v = localStorage.getItem(PREFIX + key);
    if (v !== null) return JSON.parse(v) as T;
  } catch {}
  return fallback ?? (undefined as unknown as T);
}

export function save<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    throw new Error("Browser storage full; clear data in the Data tab");
  }
}

export function storeRaw<T>(key: string, fallback?: T): T {
  if (typeof window === "undefined") return fallback ?? (undefined as unknown as T);
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return JSON.parse(v) as T;
  } catch {}
  return fallback ?? (undefined as unknown as T);
}

export function saveRaw<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function remove(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PREFIX + key);
}