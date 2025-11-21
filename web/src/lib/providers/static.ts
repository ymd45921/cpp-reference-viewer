import { STATIC_WIKI_PREFIX, STATIC_SEARCH_PREFIX, STATIC_TREE_PATH, STATIC_TREE_FLAT_PATH } from "@/lib/config";
import { getContentType } from "@/lib/wiki-core";
import { listFromTree } from "@/lib/shared/tree";
import { bm25Score, fetchJson, hash1, tokenize } from "@/lib/shared/search";
import type { Provider, DirItem, TreeNode, Hit, FileHit } from "./types";
import { logger } from "@/lib/logger";

export function createStaticProvider(origin: string): Provider {
  let cachedTree: TreeNode[] | null = null;
  return {
    async exists(rel) {
      const t0 = Date.now();
      if (!cachedTree) {
        const r = await fetch(`${origin}${STATIC_TREE_PATH}`);
        if (!r.ok) return null;
        cachedTree = (await r.json()) as TreeNode[];
      }
      const parts = (rel || "").split("/").filter(Boolean);
      if (parts.length === 0) {
        logger.debug({ rel, kind: "dir", ms: Date.now() - t0 }, "static.exists");
        return "dir";
      }
      let nodes: TreeNode[] | null = cachedTree;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const matched: TreeNode | undefined = (nodes ?? []).find((n) => n.name === p && !!n.children);
        if (!matched) {
          nodes = null;
          break;
        }
        nodes = matched.children || null;
      }
      if (nodes) {
        logger.debug({ rel, kind: "dir", ms: Date.now() - t0 }, "static.exists");
        return "dir";
      }
      const flat = await this.getTreeFlat();
      const isFile = flat.some((f) => f.path === rel);
      logger.debug({ rel, kind: isFile ? "file" : null, ms: Date.now() - t0 }, "static.exists");
      return isFile ? "file" : null;
    },
    async readFile(rel) {
      const t0 = Date.now();
      const r = await fetch(`${origin}${STATIC_WIKI_PREFIX}/${encodeURI(rel)}`);
      if (!r.ok) throw new Error(String(r.status));
      const buf = await r.arrayBuffer();
      logger.debug({ rel, bytes: buf.byteLength, ms: Date.now() - t0 }, "static.readFile");
      return new Uint8Array(buf);
    },
    async listDir(rel) {
      const t0 = Date.now();
      if (!cachedTree) {
        const r = await fetch(`${origin}${STATIC_TREE_PATH}`);
        if (!r.ok) return [];
        cachedTree = (await r.json()) as TreeNode[];
      }
      const items: DirItem[] = listFromTree(cachedTree, rel || "");
      logger.info({ rel, count: items.length, ms: Date.now() - t0 }, "static.listDir");
      return items;
    },
    async getTree() {
      const t0 = Date.now();
      if (cachedTree) return cachedTree;
      const r = await fetch(`${origin}${STATIC_TREE_PATH}`);
      if (!r.ok) return [];
      cachedTree = (await r.json()) as TreeNode[];
      logger.info({ source: "static", ms: Date.now() - t0 }, "static.getTree");
      return cachedTree;
    },
    async getTreeFlat() {
      const t0 = Date.now();
      try {
        const r = await fetch(`${origin}${STATIC_TREE_FLAT_PATH}`);
        if (r.ok) {
          const flat = (await r.json()) as Array<{ name: string; path: string }>;
          logger.info({ source: "static:flat", ms: Date.now() - t0, count: flat.length }, "static.getTreeFlat");
          return flat;
        }
      } catch {}
      const tree = await this.getTree();
      const acc: Array<{ name: string; path: string }> = [];
      (function flatten(nodes: TreeNode[], out: Array<{ name: string; path: string }>) {
        for (const n of nodes || []) {
          if (n.path) out.push({ name: n.name, path: n.path });
          if (n.children) flatten(n.children, out);
        }
      })(tree, acc);
      logger.info({ source: "static:tree", ms: Date.now() - t0, count: acc.length }, "static.getTreeFlat");
      return acc;
    },
    async search(q) {
      const t0 = Date.now();
      if (!q.trim()) return [];
      const manifest = await fetchJson<{ N: number; avgLen: number }>(`${origin}${STATIC_SEARCH_PREFIX}/manifest.json`);
      const docs = await fetchJson<Array<{ id: number; path: string; title: string; len: number; snippet: string }>>(`${origin}${STATIC_SEARCH_PREFIX}/docs.json`);
      const terms = tokenize(q);
      const buckets = Array.from(new Set(terms.map((t) => hash1(t))));
      const shardMap = new Map<string, Record<string, Array<[number, number]>>>();
      await Promise.all(
        buckets.map(async (b) => {
          try {
            const data = await fetchJson<Record<string, Array<[number, number]>>>(`${origin}${STATIC_SEARCH_PREFIX}/shards/${b}.json`);
            shardMap.set(b, data);
          } catch {}
        })
      );
      const scores = bm25Score(manifest, docs as any, terms, shardMap);
      const hits: Hit[] = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([docId, score]) => ({ path: (docs as any)[docId].path, title: (docs as any)[docId].title, snippet: (docs as any)[docId].snippet, score }));
      logger.info({ q, terms: terms.length, buckets: buckets.length, count: hits.length, ms: Date.now() - t0 }, "static.search");
      return hits;
    },
    async searchFilesByName(q) {
      const t0 = Date.now();
      const lc = q.toLowerCase();
      try {
        const r = await fetch(`${origin}${STATIC_TREE_FLAT_PATH}`);
        if (r.ok) {
          const flat = (await r.json()) as Array<{ name: string; path: string }>;
          const hits = flat.filter((f) => f.name.toLowerCase().includes(lc)).slice(0, 200);
          logger.info({ q, count: hits.length, source: "flat", ms: Date.now() - t0 }, "static.searchFilesByName");
          return hits;
        }
      } catch {}
      const tree = await this.getTree();
      const acc: FileHit[] = [];
      function flatten(nodes: TreeNode[], out: FileHit[]) {
        for (const n of nodes || []) {
          if (n.path) out.push({ name: n.name, path: n.path });
          if (n.children) flatten(n.children, out);
        }
      }
      flatten(tree, acc);
      const hits = acc.filter((f) => f.name.toLowerCase().includes(lc)).slice(0, 200);
      logger.info({ q, count: hits.length, source: "tree", ms: Date.now() - t0 }, "static.searchFilesByName");
      return hits;
    },
  };
}