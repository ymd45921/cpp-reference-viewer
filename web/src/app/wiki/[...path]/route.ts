import { NextRequest } from "next/server";
import { getContentType, sanitizeHtml, BLOCK_ANALYTICS } from "@/lib/wiki-core";
import { createStaticProvider } from "@/lib/providers/static";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  const rel = (p.path || []).join("/");
  const origin = new URL(req.url).origin;
  const provider = createStaticProvider(origin);
  const kind = await provider.exists(rel);
  if (kind === "file") {
    const data = await provider.readFile(rel);
    const type = getContentType(rel);
    const payload = /html/.test(type) && BLOCK_ANALYTICS ? sanitizeHtml(Buffer.from(data)) : Buffer.from(data);
    return new Response(new Uint8Array(payload), { status: 200, headers: { "Content-Type": type, "Cache-Control": "no-cache" } });
  }
  if (kind === "dir") {
    const url = `/dir-index/index.html?path=${encodeURIComponent(rel)}`;
    return new Response(null, { status: 302, headers: { Location: url } });
  }
  return new Response("Not Found", { status: 404 });
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  const rel = (p.path || []).join("/");
  const origin = new URL(req.url).origin;
  const provider = createStaticProvider(origin);
  const kind = await provider.exists(rel);
  if (kind === "file") {
    const type = getContentType(rel);
    return new Response(null, { status: 200, headers: { "Content-Type": type, "Cache-Control": "no-cache" } });
  }
  if (kind === "dir") {
    return new Response(null, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  }
  return new Response(null, { status: 404 });
}