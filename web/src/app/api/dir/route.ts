import { NextRequest } from "next/server";
import path from "node:path";
import { WIKI_DIR, resolveWikiFile, dirExists, listDir } from "@/lib/wiki";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rel = (searchParams.get("path") || "").replace(/^\/+/, "");
  const target = rel ? resolveWikiFile(rel) : WIKI_DIR;
  if (!target) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  if (!(await dirExists(target))) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  const items = await listDir(target);
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
  });
}