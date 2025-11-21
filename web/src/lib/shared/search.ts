import path from "node:path";

export type Manifest = { N: number; avgLen: number };
export type DocEntry = { id: number; path: string; title: string; len: number; snippet: string };

function isCJK(cp: number): boolean {
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df);
}

export function tokenize(q: string): string[] {
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

export function hash1(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 24).toString(16).padStart(2, "0");
}

export async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

export function bm25Score(
  manifest: Manifest,
  docs: DocEntry[],
  terms: string[],
  shardMap: Map<string, Record<string, Array<[number, number]>>>,
): Map<number, number> {
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
  return scores;
}

export function makeSnippet(text: string, q: string): string {
  const lc = text.toLowerCase();
  const term = q.toLowerCase().split(/\s+/).filter(Boolean)[0];
  const idx = term ? lc.indexOf(term) : -1;
  if (idx < 0) return text.slice(0, 200);
  const start = Math.max(0, idx - 100);
  const end = Math.min(text.length, idx + 100);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export function toRelPath(root: string, abs: string): string {
  return path.relative(root, abs).replaceAll(path.sep, "/");
}