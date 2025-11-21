import { NextRequest } from "next/server";
import path from "node:path";
import { getProvider } from "@/lib/providers/factory";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rel = (searchParams.get("path") || "").replace(/^\/+/, "");
  const origin = new URL(req.url).origin;
  const provider = getProvider(origin);
  const items = await provider.listDir(rel);
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
  });
}