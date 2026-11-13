import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "D Pics - Props, Systems & Tracker",
  description:
    "NBA betting analytics with player props, team stats, schedule analysis, and bet tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}