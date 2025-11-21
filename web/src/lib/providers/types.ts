export type DirItem = { name: string; isDir: boolean; relPath: string };
export type TreeNode = { name: string; path?: string; children?: TreeNode[] };
export type Hit = { path: string; title: string; snippet: string; score?: number };
export type FileHit = { name: string; path: string };

export interface Provider {
  exists(rel: string): Promise<"file" | "dir" | null>;
  readFile(rel: string): Promise<Uint8Array>;
  listDir(rel: string): Promise<DirItem[]>;
  getTree(): Promise<TreeNode[]>;
  getTreeFlat(): Promise<FileHit[]>;
  search(q: string): Promise<Hit[]>;
  searchFilesByName(q: string): Promise<FileHit[]>;
}