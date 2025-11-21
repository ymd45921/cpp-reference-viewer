import { NextRequest } from "next/server";
import path from "node:path";
import { WIKI_DIR, walkHtmlFiles, readFile, htmlToText } from "@/lib/wiki";

type Hit = { path: string; title: string; snippet: string; score: number };

let cacheIndex: { docs: Array<{ path: string; text: string; title: string }> } | null = null;

async function ensureIndex() {
  if (cacheIndex) return cacheIndex;
  const files = await walkHtmlFiles(WIKI_DIR);
  const docs: Array<{ path: string; text: string; title: string }> = [];
  for (const f of files) {
    try {
      const buf = await readFile(f);
      const text = await htmlToText(buf);
      const titleMatch = buf.toString("utf-8").match(/<title>(.*?)<\/title>/i);
      const title = titleMatch?.[1] || path.basename(f);
      const rel = path.relative(WIKI_DIR, f).replaceAll(path.sep, "/");
      docs.push({ path: rel, text, title });
    } catch {}
  }
  cacheIndex = { docs };
  return cacheIndex;
}

function scoreDoc(text: string, q: string): number {
  const lc = text.toLowerCase();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const t of terms) {
    const count = lc.split(t).length - 1;
    score += count;
  }
  return score;
}

function makeSnippet(text: string, q: string): string {
  const lc = text.toLowerCase();
  const term = q.toLowerCase().split(/\s+/).filter(Boolean)[0];
  const idx = term ? lc.indexOf(term) : -1;
  if (idx < 0) return text.slice(0, 200);
  const start = Math.max(0, idx - 100);
  const end = Math.min(text.length, idx + 100);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

async function fetchJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return await r.json();
}

function hash1(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 24).toString(16).padStart(2, "0");
}

function isCJK(cp: number): boolean {
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df);
}

function tokenize(q: string): string[] {
  const out: string[] = [];
  const a = q.toLowerCase();
  let i = 0;
  while (i < a.length) {
    const cp = a.codePointAt(i) || 0;
    if ((cp >= 48 && cp <= 57) || (cp >= 97 && cp <= 122)) {
      let j = i;
      while (j < a.length) {
        const c = a.codePointAt(j) || 0;
        if ((c >= 48 && c <= 57) || (c >= 97 && c <= 122)) j += c > 0xffff ? 2 : 1; else break;
      }
      const w = a.slice(i, j);
      if (w.length >= 2) out.push(w);
      i = j; continue;
    }
    if (isCJK(cp)) {
      let j = i;
      while (j < a.length && isCJK((a.codePointAt(j) || 0))) j += (a.codePointAt(j) || 0) > 0xffff ? 2 : 1;
      const seg = a.slice(i, j);
      for (let k = 0; k + 2 <= seg.length; k++) out.push(seg.slice(k, k + 2));
      i = j; continue;
    }
    i += cp > 0xffff ? 2 : 1;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
  const origin = new URL(req.url).origin;
  try {
    const manifest: { N: number; avgLen: number } = await fetchJson(`${origin}/search-index/manifest.json`);
    const docs: Array<{ id: number; path: string; title: string; len: number; snippet: string }> = await fetchJson(`${origin}/search-index/docs.json`);
    const terms = tokenize(q);
    const buckets = Array.from(new Set(terms.map((t) => hash1(t))));
    const shardMap = new Map<string, Record<string, Array<[number, number]>>>();
    await Promise.all(
      buckets.map(async (b) => {
        try {
          const data = await fetchJson(`${origin}/search-index/shards/${b}.json`);
          shardMap.set(b, data as Record<string, Array<[number, number]>>);
        } catch {}
      })
    );
    const k1 = 1.2, b = 0.75;
    const scores = new Map<number, number>();
    for (const t of terms) {
      const bkey = hash1(t);
      const shard = shardMap.get(bkey);
      if (!shard) continue;
      const postings = shard[t];
      if (!postings) continue;
      const df = postings.length;
      const idf = Math.log((manifest.N - df + 0.5) / (df + 0.5) + 1);
      for (const [docId, tf] of postings) {
        const L = docs[docId]?.len || manifest.avgLen;
        const denom = tf + k1 * (1 - b + b * (L / (manifest.avgLen || 1)));
        const add = idf * ((tf * (k1 + 1)) / (denom || 1));
        scores.set(docId, (scores.get(docId) || 0) + add);
      }
    }
    const hits: Hit[] = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([docId, score]) => ({ path: docs[docId].path, title: docs[docId].title, snippet: docs[docId].snippet, score }));
    return new Response(JSON.stringify(hits), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } });
  } catch {
    const idx = await ensureIndex();
    const hits: Hit[] = idx.docs
      .map((d) => ({ path: d.path, title: d.title, snippet: makeSnippet(d.text, q), score: scoreDoc(d.text, q) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
    return new Response(JSON.stringify(hits), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } });
  }
}