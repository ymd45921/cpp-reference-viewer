import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { WIKI_DIR as DEFAULT_WIKI_DIR, htmlToText } from "../src/lib/wiki-fs";
import { tokenize, hash1 } from "../src/lib/shared/search";

function isHtml(name: string) { return /\.html?$/i.test(name) }

async function walk(dir: string, out: string[]) {
  const ents = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.isFile() && isHtml(e.name)) out.push(full);
  }
}

async function exists(p: string) { try { await fsp.access(p, fs.constants.R_OK); return true } catch { return false } }

export async function buildSearchIndex(opts: { wikiDir?: string; outDir: string }) {
  const wikiDir = opts.wikiDir ? path.resolve(opts.wikiDir) : DEFAULT_WIKI_DIR;
  const outDir = path.resolve(opts.outDir);
  await fsp.mkdir(outDir, { recursive: true });
  await fsp.mkdir(path.join(outDir, "shards"), { recursive: true });
  const files: string[] = [];
  if (!(await exists(wikiDir))) {
    await fsp.writeFile(path.join(outDir, "docs.json"), JSON.stringify([]));
    await fsp.writeFile(path.join(outDir, "manifest.json"), JSON.stringify({ N: 0, avgLen: 0, shards: {} }));
    process.stdout.write(`WIKI_DIR not found: ${wikiDir}. Wrote empty index\n`);
    return;
  }
  await walk(wikiDir, files);
  const docs: Array<{ id: number; path: string; title: string; len: number; snippet: string }> = [];
  const postings = new Map<string, Array<[number, number]>>();
  let totalLen = 0;
  for (let id = 0; id < files.length; id++) {
    const f = files[id];
    const buf = await fsp.readFile(f);
    const s = buf.toString("utf-8");
    const m = s.match(/<title>(.*?)<\/title>/i);
    const title = m?.[1] || path.basename(f);
    const text = await htmlToText(buf);
    const rel = path.relative(wikiDir, f).replaceAll(path.sep, "/");
    const snippet = text.slice(0, 240);
    const tokens = tokenize(title + " " + text.slice(0, 1200));
    totalLen += tokens.length;
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, n] of tf.entries()) {
      let arr = postings.get(t); if (!arr) { arr = []; postings.set(t, arr); }
      arr.push([id, n]);
    }
    docs.push({ id, path: rel, title, len: tokens.length, snippet });
  }
  const N = docs.length; const avgLen = N ? totalLen / N : 0;
  const manifest: { N: number; avgLen: number; shards: Record<string, number> } = { N, avgLen, shards: {} };
  const buckets = new Map<string, Record<string, Array<[number, number]>>>();
  for (const [t, arr] of postings.entries()) {
    const b = hash1(t);
    if (!buckets.has(b)) buckets.set(b, {});
    buckets.get(b)![t] = arr;
  }
  for (const [key, obj] of buckets.entries()) {
    await fsp.writeFile(path.join(outDir, "shards", `${key}.json`), JSON.stringify(obj));
    manifest.shards[key] = Object.keys(obj).length;
  }
  await fsp.writeFile(path.join(outDir, "docs.json"), JSON.stringify(docs));
  await fsp.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest));
  process.stdout.write(`Indexed ${N} docs, ${postings.size} tokens\n`);
}

function argVal(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

const invokedDirectly = (process.argv[1] || "").includes("build-search-index");
if (invokedDirectly) {
  const out = argVal("--out") || path.resolve(process.cwd(), "public/search-index");
  const wiki = argVal("--wiki") || DEFAULT_WIKI_DIR;
  buildSearchIndex({ wikiDir: wiki, outDir: out }).catch((e) => { console.error(e); process.exit(1); });
}