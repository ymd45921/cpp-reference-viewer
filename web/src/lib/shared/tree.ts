import path from "node:path";
import { promises as fsp } from "node:fs";

export type TreeNode = { name: string; path?: string; children?: TreeNode[] };

export async function buildTreeFs(dirAbs: string, relDir: string, exclude: string[]): Promise<TreeNode[]> {
  const entries = await fsp.readdir(dirAbs, { withFileTypes: true });
  const dirs: TreeNode[] = [];
  const files: TreeNode[] = [];
  for (const e of entries) {
    const name = e.name;
    const abs = path.join(dirAbs, name);
    const rel = path.posix.join(relDir, name);
    const top = (rel.split("/")[0] || rel).toLowerCase();
    if (exclude.map((d) => d.toLowerCase()).includes(top)) continue;
    if (e.isDirectory()) {
      const children = await buildTreeFs(abs, rel, exclude);
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

export function listFromTree(tree: TreeNode[], relDir: string): Array<{ name: string; isDir: boolean; relPath: string }> {
  const parts = relDir.split("/").filter(Boolean);
  let nodes: TreeNode[] = tree;
  for (const p of parts) {
    const next = nodes.find((n) => n.name === p && n.children);
    if (!next || !next.children) return [];
    nodes = next.children;
  }
  const out: Array<{ name: string; isDir: boolean; relPath: string }> = [];
  for (const n of nodes) {
    if (n.children && typeof n.path === "undefined") {
      out.push({ name: n.name, isDir: true, relPath: path.posix.join(relDir, n.name) });
    } else if (n.path) {
      out.push({ name: n.name, isDir: false, relPath: n.path });
    }
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.relPath.localeCompare(b.relPath) : a.isDir ? -1 : 1));
  return out;
}