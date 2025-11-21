import path from "node:path";
import { WIKI_DIR, resolveWikiFile, fileExists, dirExists, readFile as fsReadFile, listDir as fsListDir, htmlToText } from "@/lib/wiki";
import { buildTreeFs } from "@/lib/shared/tree";
import type { Provider, DirItem, TreeNode, Hit, FileHit } from "./types";
import { logger } from "@/lib/logger";

type Doc = { path: string; text: string; title: string };
let cacheIndex: { docs: Doc[] } | null = null;

async function ensureIndex(): Promise<{ docs: Doc[] }> {
  if (cacheIndex) return cacheIndex;
  const { walkHtmlFiles } = await import("@/lib/wiki");
  const files = await walkHtmlFiles(WIKI_DIR);
  const docs: Doc[] = [];
  for (const f of files) {
    try {
      const buf = await fsReadFile(f);
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

export function createFsProvider(): Provider {
  return {
    async exists(rel) {
      const t0 = Date.now();
      const abs = resolveWikiFile(rel);
      if (!abs) return null;
      if (await fileExists(abs)) return "file";
      if (await dirExists(abs)) return "dir";
      logger.debug({ rel, ms: Date.now() - t0 }, "fs.exists");
      return null;
    },
    async readFile(rel) {
      const t0 = Date.now();
      const abs = resolveWikiFile(rel);
      if (!abs) throw new Error("Not Found");
      const buf = await fsReadFile(abs);
      logger.debug({ rel, bytes: buf.byteLength, ms: Date.now() - t0 }, "fs.readFile");
      return new Uint8Array(buf);
    },
    async listDir(rel) {
      const t0 = Date.now();
      const target = rel ? resolveWikiFile(rel) : WIKI_DIR;
      if (!target) return [];
      if (!(await dirExists(target))) return [];
      const items: DirItem[] = await fsListDir(target);
      logger.info({ rel, count: items.length, ms: Date.now() - t0 }, "fs.listDir");
      return items;
    },
    async getTree() {
      const t0 = Date.now();
      const tree: TreeNode[] = await buildTreeFs(WIKI_DIR, "", (process.env.WIKI_EXCLUDE || "common").split(",").map((s) => s.trim()).filter(Boolean));
      logger.info({ source: "fs", ms: Date.now() - t0 }, "fs.getTree");
      return tree;
    },
    async getTreeFlat() {
      const t0 = Date.now();
      const { walkHtmlFiles } = await import("@/lib/wiki");
      const files = await walkHtmlFiles(WIKI_DIR);
      const out: FileHit[] = files.map((f) => ({ name: path.basename(f), path: path.relative(WIKI_DIR, f).replaceAll(path.sep, "/") }));
      logger.info({ count: out.length, ms: Date.now() - t0 }, "fs.getTreeFlat");
      return out;
    },
    async search(q) {
      const t0 = Date.now();
      if (!q.trim()) return [];
      const idx = await ensureIndex();
      const hits: Hit[] = idx.docs
        .map((d) => ({ path: d.path, title: d.title, snippet: makeSnippet(d.text, q), score: scoreDoc(d.text, q) }))
        .filter((h) => (h.score || 0) > 0)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 50);
      logger.info({ q, count: hits.length, ms: Date.now() - t0 }, "fs.search");
      return hits;
    },
    async searchFilesByName(q) {
      const t0 = Date.now();
      const { walkHtmlFiles } = await import("@/lib/wiki");
      const files = await walkHtmlFiles(WIKI_DIR);
      const lc = q.toLowerCase();
      const out: FileHit[] = [];
      for (const f of files) {
        const name = path.basename(f);
        if (name.toLowerCase().includes(lc)) {
          const rel = path.relative(WIKI_DIR, f).replaceAll(path.sep, "/");
          out.push({ name, path: rel });
        }
      }
      out.sort((a, b) => a.path.localeCompare(b.path, "en"));
      const top = out.slice(0, 200);
      logger.info({ q, count: top.length, ms: Date.now() - t0 }, "fs.searchFilesByName");
      return top;
    },
  };
}