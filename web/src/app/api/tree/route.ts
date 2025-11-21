import { NextRequest } from "next/server";
import { getProvider } from "@/lib/providers/factory";
import type { TreeNode, FileHit } from "@/lib/providers/types";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const provider = getProvider(origin);
  const flat = (url.searchParams.get("flat") || "").toLowerCase();
  if (flat === "1" || flat === "true") {
    const list: FileHit[] = await provider.getTreeFlat();
    return new Response(JSON.stringify(list), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } });
  }
  const tree = await provider.getTree();
  return new Response(JSON.stringify(tree), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } });
}