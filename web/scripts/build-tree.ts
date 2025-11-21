import path from "node:path";
import { promises as fsp } from "node:fs";
import { WIKI_DIR as DEFAULT_WIKI_DIR, EXCLUDE_DIRS as DEFAULT_EXCLUDE } from "../src/lib/wiki";
import { buildTreeFs } from "../src/lib/shared/tree";

export async function buildTree(opts: { wikiDir?: string; exclude?: string[]; outTree: string; outFlat: string }) {
  const wikiDir = opts.wikiDir ? path.resolve(opts.wikiDir) : DEFAULT_WIKI_DIR;
  const exclude = opts.exclude ?? DEFAULT_EXCLUDE;
  await fsp.mkdir(path.dirname(opts.outTree), { recursive: true });
  const tree = await buildTreeFs(wikiDir, "", exclude);
  await fsp.writeFile(opts.outTree, JSON.stringify(tree));
  const flat: Array<{ name: string; path: string }> = [];
  function flatten(nodes: any[], acc: Array<{ name: string; path: string }>) {
    for (const n of nodes || []) {
      if (n.path) acc.push({ name: n.name, path: n.path });
      if (n.children) flatten(n.children, acc);
    }
  }
  flatten(tree as any, flat);
  await fsp.mkdir(path.dirname(opts.outFlat), { recursive: true });
  await fsp.writeFile(opts.outFlat, JSON.stringify(flat));
  process.stdout.write(`Wrote tree.json & tree-flat.json\n`);
}

function argVal(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

const invokedDirectly = (process.argv[1] || "").includes("build-tree");
if (invokedDirectly) {
  const outTree = argVal("--out-tree") || path.resolve(process.cwd(), "public/tree.json");
  const outFlat = argVal("--out-flat") || path.resolve(process.cwd(), "public/tree-flat.json");
  const wiki = argVal("--wiki") || DEFAULT_WIKI_DIR;
  const exclude = (argVal("--exclude") || "").split(",").map((s) => s.trim()).filter(Boolean);
  buildTree({ wikiDir: wiki, exclude: exclude.length ? exclude : undefined, outTree: outTree, outFlat: outFlat }).catch((e) => { console.error(e); process.exit(1); });
}