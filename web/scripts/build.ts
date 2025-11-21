import path from "node:path";
import { buildSearchIndex } from "./build-search-index";
import { buildTree } from "./build-tree";
import { buildWiki } from "./build-wiki";
import { STATIC_SEARCH_PREFIX, STATIC_TREE_PATH, STATIC_TREE_FLAT_PATH, STATIC_WIKI_PREFIX } from "../src/lib/config";
import { WIKI_DIR, EXCLUDE_DIRS } from "../src/lib/wiki-fs";
import { BLOCK_ANALYTICS } from "../src/lib/wiki-core";
import { logger } from "../src/lib/logger";

function toFsPath(prefix: string): string {
  const rel = prefix.replace(/^\//, "");
  return path.resolve(process.cwd(), path.join("public", rel));
}

async function main() {
  const declared = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    WIKI_DIR: process.env.WIKI_DIR,
    WIKI_EXCLUDE: process.env.WIKI_EXCLUDE,
    WIKI_BLOCK_ANALYTICS: process.env.WIKI_BLOCK_ANALYTICS,
    WIKI_OUT_DIR: process.env.WIKI_OUT_DIR,
    NEXT_PUBLIC_WIKI_HOME: process.env.NEXT_PUBLIC_WIKI_HOME,
    NEXT_PUBLIC_ENABLE_SEARCH: process.env.NEXT_PUBLIC_ENABLE_SEARCH,
    NEXT_PUBLIC_MOBILE_BOTTOM_BAR: process.env.NEXT_PUBLIC_MOBILE_BOTTOM_BAR,
  } as Record<string, string | undefined>;
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(declared)) {
    if (typeof v !== "undefined" && v !== "") env[k] = v;
  }
  logger.info({ env, effective: { wikiDir: WIKI_DIR, exclude: EXCLUDE_DIRS, blockAnalytics: BLOCK_ANALYTICS } }, "build:env");
  const outIndex = toFsPath(STATIC_SEARCH_PREFIX);
  const outTree = toFsPath(STATIC_TREE_PATH);
  const outFlat = toFsPath(STATIC_TREE_FLAT_PATH);
  const outWiki = toFsPath(STATIC_WIKI_PREFIX);
  logger.info({ outIndex, outTree, outFlat, outWiki }, "build:paths");
  await buildSearchIndex({ wikiDir: WIKI_DIR, outDir: outIndex });
  await buildTree({ wikiDir: WIKI_DIR, exclude: EXCLUDE_DIRS, outTree, outFlat });
  const sanitize = BLOCK_ANALYTICS;
  await buildWiki({ wikiDir: WIKI_DIR, outDir: outWiki, sanitize, strategy: "copy" });
}

main().catch((e) => { console.error(e); process.exit(1); });