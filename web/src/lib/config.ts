export const RUNTIME_MODE = (process.env.RUNTIME_MODE as string) || (process.env.VERCEL ? "serverless" : "server");
export const STATIC_WIKI_PREFIX = "/wiki";
export const STATIC_SEARCH_PREFIX = "/search-index";
export const STATIC_TREE_PATH = "/tree.json";
export const STATIC_TREE_FLAT_PATH = "/tree-flat.json";