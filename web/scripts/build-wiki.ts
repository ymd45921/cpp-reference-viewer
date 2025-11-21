import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import { WIKI_DIR as DEFAULT_WIKI_DIR, sanitizeHtml } from "../src/lib/wiki";
import { logger } from "../src/lib/logger";

type Strategy = "link" | "copy";

const DEFAULT_OUT_DIR = process.env.WIKI_OUT_DIR ? path.resolve(process.env.WIKI_OUT_DIR) : path.resolve(process.cwd(), "public/wiki");

async function ensureDir(p: string) {
  await fsp.mkdir(p, { recursive: true });
}

async function rimraf(p: string) {
  try { await fsp.rm(p, { recursive: true, force: true }); } catch {}
}

async function walkCopySanitize(src: string, dst: string) {
  const ents = await fsp.readdir(src, { withFileTypes: true });
  for (const e of ents) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      await ensureDir(d);
      await walkCopySanitize(s, d);
    } else if (e.isFile()) {
      if (/\.html?$/i.test(e.name)) {
        const buf = await fsp.readFile(s);
        const out = sanitizeHtml(buf);
        await fsp.writeFile(d, out);
      } else {
        await fsp.copyFile(s, d);
      }
    }
  }
}

async function copyAsIs(src: string, dst: string) {
  const ents = await fsp.readdir(src, { withFileTypes: true });
  for (const e of ents) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      await ensureDir(d);
      await copyAsIs(s, d);
    } else if (e.isFile()) {
      await fsp.copyFile(s, d);
    }
  }
}

async function linkDir(src: string, dst: string) {
  const type = process.platform === "win32" ? "junction" : "dir";
  await ensureDir(path.dirname(dst));
  try { await rimraf(dst); } catch {}
  await fsp.symlink(src, dst, type as any);
}

export async function buildWiki(opts: { wikiDir?: string; outDir: string; sanitize?: boolean; strategy?: Strategy }) {
  const wikiDir = opts.wikiDir ? path.resolve(opts.wikiDir) : DEFAULT_WIKI_DIR;
  const outDir = path.resolve(opts.outDir);
  const sanitize = !!opts.sanitize;
  const strategy: Strategy = opts.strategy || "link";
  logger.info({ wikiDir, outDir, sanitize, strategy }, "build:wiki start");
  await ensureDir(outDir);
  if (sanitize) {
    await rimraf(outDir);
    await ensureDir(outDir);
    const t0 = Date.now();
    await walkCopySanitize(wikiDir, outDir);
    logger.info({ ms: Date.now() - t0 }, "build:wiki sanitize done");
    return;
  }
  if (strategy === "link") {
    try {
      const t0 = Date.now();
      await linkDir(wikiDir, outDir);
      logger.info({ ms: Date.now() - t0 }, "build:wiki link done");
      return;
    } catch (e) {
      logger.warn({ err: String(e) }, "build:wiki link failed, fallback to copy");
    }
  }
  await rimraf(outDir);
  await ensureDir(outDir);
  const t1 = Date.now();
  await copyAsIs(wikiDir, outDir);
  logger.info({ ms: Date.now() - t1 }, "build:wiki copy done");
}

function has(name: string): boolean { return process.argv.includes(name) }
function argVal(name: string): string | undefined { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined }
const invokedDirectly = (process.argv[1] || "").includes("build-wiki");
if (invokedDirectly) {
  const wiki = argVal("--wiki") || DEFAULT_WIKI_DIR;
  const out = argVal("--out") || DEFAULT_OUT_DIR;
  const sanitize = has("--sanitize") || has("--sanitize-html");
  const strategy: Strategy = has("--copy") ? "copy" : "link";
  buildWiki({ wikiDir: wiki, outDir: out, sanitize, strategy }).catch((e) => { console.error(e); process.exit(1); });
}