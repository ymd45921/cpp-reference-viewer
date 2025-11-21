import { NextRequest } from "next/server";
import { getContentType, resolveWikiFile, fileExists, readFile, dirExists, listDir, sanitizeHtml, BLOCK_ANALYTICS } from "@/lib/wiki";
import path from "node:path";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  const rel = (p.path || []).join("/");
  const abs = resolveWikiFile(rel);
  if (!abs) return new Response("Not Found", { status: 404 });
  if (await fileExists(abs)) {
    const data = await readFile(abs);
    const type = getContentType(abs);
    const payload = /html/.test(type) && BLOCK_ANALYTICS ? sanitizeHtml(data) : data;
    const body = new Uint8Array(payload);
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": type, "Cache-Control": "no-cache" },
    });
  }
  if (await dirExists(abs)) {
    const url = `/dir-index/index.html?path=${encodeURIComponent(rel)}`;
    return new Response(null, { status: 302, headers: { Location: url } });
  }
  return new Response("Not Found", { status: 404 });
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const p = await params;
  const rel = (p.path || []).join("/");
  const abs = resolveWikiFile(rel);
  if (!abs) return new Response(null, { status: 404 });
  if (await fileExists(abs)) {
    const type = getContentType(abs);
    return new Response(null, {
      status: 200,
      headers: { "Content-Type": type, "Cache-Control": "no-cache" },
    });
  }
  if (await dirExists(abs)) {
    return new Response(null, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }
  return new Response(null, { status: 404 });
}