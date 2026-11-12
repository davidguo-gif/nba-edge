import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // cache 1 hour

const DATA_FILE = path.join(process.cwd(), "public", "nbadata.json");

export async function GET() {
  try {
    // Try cached data first
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return new NextResponse(raw, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    }

    // Fallback: try nbadata.js from nba-edge project
    const legacyPath = path.join(
      process.cwd(),
      "..",
      "nba-edge",
      "nbadata.js",
    );
    if (fs.existsSync(legacyPath)) {
      const raw = fs.readFileSync(legacyPath, "utf-8");
      const json = raw.replace(/^window\.NBA_DATA\s*=\s*/, "").replace(/;\s*$/, "");
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    }

    return NextResponse.json(
      { error: "No data found. Run: python fetch_nba_data.py" },
      { status: 404 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}