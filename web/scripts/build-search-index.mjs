import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";

const WIKI_DIR = process.env.WIKI_DIR ? path.resolve(process.env.WIKI_DIR) : path.resolve(process.cwd(), "../wiki");
const OUT_DIR = path.resolve(process.cwd(), "public/search-index");

function isHtml(name) { return /\.html?$/i.test(name) }
function isCJK(cp) { return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x2a6df) }
function hash1(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 } return (h >>> 24).toString(16).padStart(2, "0") }

async function walk(dir, out) {
  const ents = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.isFile() && isHtml(e.name)) out.push(full);
  }
}

function htmlToText(buf) {
  const s = buf.toString("utf-8");
  const noScript = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, "");
  const text = noStyle.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

function tokenize(s) {
  const out = [];
  const a = s.toLowerCase();
  let i = 0;
  while (i < a.length) {
    const cp = a.codePointAt(i);
    if (!cp) break;
    if ((cp >= 48 && cp <= 57) || (cp >= 97 && cp <= 122)) {
      let j = i;
      while (j < a.length) {
        const c = a.codePointAt(j);
        if (!c) break;
        if ((c >= 48 && c <= 57) || (c >= 97 && c <= 122)) j += c > 0xffff ? 2 : 1; else break;
      }
      const w = a.slice(i, j);
      if (w.length >= 2) out.push(w);
      i = j; continue;
    }
    if (isCJK(cp)) {
      let j = i;
      while (j < a.length && isCJK(a.codePointAt(j) || 0)) j += (a.codePointAt(j) || 0) > 0xffff ? 2 : 1;
      const seg = a.slice(i, j);
      for (let k = 0; k + 2 <= seg.length; k++) out.push(seg.slice(k, k + 2));
      i = j; continue;
    }
    i += cp > 0xffff ? 2 : 1;
  }
  return out;
}

async function exists(p) { try { await fsp.access(p, fs.constants.R_OK); return true } catch { return false } }

async function main() {
  await fsp.mkdir(OUT_DIR, { recursive: true });
  await fsp.mkdir(path.join(OUT_DIR, "shards"), { recursive: true });
  const files = [];
  if (!(await exists(WIKI_DIR))) {
    await fsp.writeFile(path.join(OUT_DIR, "docs.json"), JSON.stringify([]));
    await fsp.writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify({ N: 0, avgLen: 0, shards: {} }));
    process.stdout.write(`WIKI_DIR not found: ${WIKI_DIR}. Wrote empty index.\n`);
    return;
  }
  await walk(WIKI_DIR, files);
  const docs = [];
  const postings = new Map();
  let totalLen = 0;
  for (let id = 0; id < files.length; id++) {
    const f = files[id];
    const buf = await fsp.readFile(f);
    const s = buf.toString("utf-8");
    const m = s.match(/<title>(.*?)<\/title>/i);
    const title = m?.[1] || path.basename(f);
    const text = htmlToText(buf);
    const rel = path.relative(WIKI_DIR, f).replaceAll(path.sep, "/");
    const snippet = text.slice(0, 240);
    const tokens = tokenize(title + " " + text.slice(0, 1200));
    totalLen += tokens.length;
    const tf = new Map(); for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const [t, n] of tf.entries()) {
      let arr = postings.get(t); if (!arr) { arr = []; postings.set(t, arr) }
      arr.push([id, n]);
    }
    docs.push({ id, path: rel, title, len: tokens.length, snippet });
  }
  const N = docs.length; const avgLen = N ? totalLen / N : 0;
  const manifest = { N, avgLen, shards: {} };
  const buckets = new Map();
  for (const [t, arr] of postings.entries()) {
    const b = hash1(t);
    if (!buckets.has(b)) buckets.set(b, {});
    const bucketObj = buckets.get(b);
    bucketObj[t] = arr;
  }
  for (const [key, obj] of buckets.entries()) {
    await fsp.writeFile(path.join(OUT_DIR, "shards", `${key}.json`), JSON.stringify(obj));
    manifest.shards[key] = Object.keys(obj).length;
  }
  await fsp.writeFile(path.join(OUT_DIR, "docs.json"), JSON.stringify(docs));
  await fsp.writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest));
  process.stdout.write(`Indexed ${N} docs, ${postings.size} tokens\n`);
}

main().catch((e) => { console.error(e); process.exit(1) });