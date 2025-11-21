import { NextRequest } from "next/server";
import path from "node:path";
import { promises as fsp } from "node:fs";
import { WIKI_DIR, EXCLUDE_DIRS } from "@/lib/wiki";

type TreeNode = { name: string; path?: string; children?: TreeNode[] };

async function build(dirAbs: string, relDir: string): Promise<TreeNode[]> {
  const entries = await fsp.readdir(dirAbs, { withFileTypes: true });
  const dirs: TreeNode[] = [];
  const files: TreeNode[] = [];
  for (const e of entries) {
    const name = e.name;
    const abs = path.join(dirAbs, name);
    const rel = path.posix.join(relDir, name);
    const top = (rel.split("/")[0] || rel).toLowerCase();
    if (EXCLUDE_DIRS.map((d) => d.toLowerCase()).includes(top)) continue;
    if (e.isDirectory()) {
      const children = await build(abs, rel);
      if (children.length > 0) dirs.push({ name, children });
      else dirs.push({ name, children: [] });
    } else if (e.isFile() && /\.html?$/i.test(name)) {
      files.push({ name, path: rel.replaceAll(path.sep, "/") });
    }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, "en"));
  files.sort((a, b) => a.name.localeCompare(b.name, "en"));
  return [...dirs, ...files];
}

export async function GET(_req: NextRequest) {
  const tree = await build(WIKI_DIR, "");
  return new Response(JSON.stringify(tree), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
  });
}