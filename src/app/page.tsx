"use client";

import { NBAProvider } from "@/lib/NBAContext";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  return (
    <NBAProvider>
      <AppShell />
    </NBAProvider>
  );
}