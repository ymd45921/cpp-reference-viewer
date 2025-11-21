import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.pathname;
  if (p.startsWith("/wiki")) {
    const rel = p.replace(/^\/wiki\/?/, "");
    const isDir = p.endsWith("/") || !/\.[A-Za-z0-9]+$/.test(rel);
    if (isDir) {
      const to = new URL("/dir-index/index.html", req.url);
      to.searchParams.set("path", rel.replace(/\/$/, ""));
      return NextResponse.redirect(to);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/wiki", "/wiki/:path*"] };