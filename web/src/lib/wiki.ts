import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";

export const WIKI_DIR = process.env.WIKI_DIR
  ? path.resolve(process.env.WIKI_DIR)
  : path.resolve(process.cwd(), "../wiki");

export const EXCLUDE_DIRS: string[] = (process.env.WIKI_EXCLUDE || "common")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const BLOCK_ANALYTICS = (process.env.WIKI_BLOCK_ANALYTICS as string) === "true";

export function normalizeWikiPath(p: string): string | null {
  const clean = p.replace(/^\/+/, "");
  const normalized = path.posix.normalize(clean);
  if (normalized.includes("..")) return null;
  return normalized;
}

export function resolveWikiFile(relativePath: string): string | null {
  const norm = normalizeWikiPath(relativePath);
  if (!norm) return null;
  const abs = path.resolve(WIKI_DIR, norm);
  const rel = path.relative(WIKI_DIR, abs);
  if (rel.startsWith("..")) return null;
  return abs;
}

export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    case ".ttf":
      return "font/ttf";
    default:
      return "application/octet-stream";
  }
}

export async function fileExists(absPath: string): Promise<boolean> {
  try {
    await fsp.access(absPath, fs.constants.R_OK);
    const st = await fsp.stat(absPath);
    return st.isFile();
  } catch {
    return false;
  }
}

export async function readFile(absPath: string): Promise<Buffer> {
  return await fsp.readFile(absPath);
}

export async function dirExists(absPath: string): Promise<boolean> {
  try {
    await fsp.access(absPath, fs.constants.R_OK);
    const st = await fsp.stat(absPath);
    return st.isDirectory();
  } catch {
    return false;
  }
}

export async function listDir(absPath: string): Promise<Array<{ name: string; isDir: boolean; relPath: string }>> {
  const entries = await fsp.readdir(absPath, { withFileTypes: true });
  const out: Array<{ name: string; isDir: boolean; relPath: string }> = [];
  for (const e of entries) {
    const name = e.name;
    const isDir = e.isDirectory();
    const relPath = path.relative(WIKI_DIR, path.join(absPath, name)).replaceAll(path.sep, "/");
    out.push({ name, isDir, relPath });
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.relPath.localeCompare(b.relPath) : a.isDir ? -1 : 1));
  return out;
}

export async function walkHtmlFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && /\.html?$/i.test(e.name)) results.push(full);
    }
  }
  await walk(root);
  return results;
}

export async function htmlToText(buf: Buffer): Promise<string> {
  const s = buf.toString("utf-8");
  const noScript = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, "");
  const text = noStyle.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

export function sanitizeHtml(buf: Buffer): Buffer {
  let s = buf.toString("utf-8");
  const stub = `<script>(function(){try{window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){}}catch(e){}})();</script>`;
  s = s.replace(/<head[^>]*>/i, (m) => m + stub);
  s = s.replace(/<script([^>]*?)src=["']https?:\/\/[^"']*(googletagmanager|google-analytics)[^"']*["']([^>]*)><\/script>/gi, '<script$1 type="text/plain" data-blocked="analytics"$2><\/script>');
  s = s.replace(/<script(\s[^>]*)?>[\s\S]*?(gtag\(|dataLayer|googletagmanager)[\s\S]*?<\/script>/gi, '<script$1>(function(){/* analytics blocked */})()<\/script>');
  return Buffer.from(s, "utf-8");
}