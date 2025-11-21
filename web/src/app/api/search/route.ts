import { NextRequest } from "next/server";
import { getProvider } from "@/lib/providers/factory";
import type { Hit } from "@/lib/providers/types";

// 使用 Provider 执行搜索

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  const origin = new URL(req.url).origin;
  const provider = getProvider(origin);
  const hits: Hit[] = await provider.search(q);
  return new Response(JSON.stringify(hits), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } });
}