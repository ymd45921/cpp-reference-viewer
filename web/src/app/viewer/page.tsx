"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Home,
  Search as SearchIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  FileText,
  CornerDownRight,
  X as XIcon,
  ExternalLink,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";

type HistoryEntry = { url: string; display: string };

function isExternalUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function toWikiUrl(rel: string): string {
  const cleaned = rel.replace(/^\/+/, "");
  return `/wiki/${cleaned}`;
}

export default function ViewerPage() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [addr, setAddr] = useState<string>("");
  const [hist, setHist] = useState<HistoryEntry[]>([]);
  const [idx, setIdx] = useState<number>(-1);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Array<{ path: string; title: string; snippet: string }>>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [panel, setPanel] = useState<"search" | "tree">("tree");
  const [tree, setTree] = useState<Array<{ name: string; path?: string; children?: any[] }>>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [draggingWidth, setDraggingWidth] = useState(false);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const HOME = (process.env.NEXT_PUBLIC_WIKI_HOME as string) || "zh/首页.html";
  const [editingAddr, setEditingAddr] = useState(false);
  const addrBoxRef = useRef<HTMLDivElement | null>(null);
  const addrInputRef = useRef<HTMLInputElement | null>(null);
  const [treeQuery, setTreeQuery] = useState("");
  const [treeFiles, setTreeFiles] = useState<Array<{ name: string; path: string }>>([]);
  const [treeResults, setTreeResults] = useState<Array<{ name: string; path: string }>>([]);
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const MOBILE_BOTTOM = (process.env.NEXT_PUBLIC_MOBILE_BOTTOM_BAR as string) !== "false";
  const [mobileBarExpanded, setMobileBarExpanded] = useState(false);
  const [mobileTitle, setMobileTitle] = useState<string>("");
  const ENABLE_SEARCH = (process.env.NEXT_PUBLIC_ENABLE_SEARCH as string) !== "false";

  function navigate(input: string) {
    const target = isExternalUrl(input) ? input : toWikiUrl(input);
    const display = isExternalUrl(input) ? input : input.replace(/^\/+/, "");
    const frame = iframeRef.current;
    if (frame) frame.src = target;
    const newHist = hist.slice(0, idx + 1).concat([{ url: target, display }]);
    setHist(newHist);
    setIdx(newHist.length - 1);
    setAddr(display);
    setEditingAddr(false);
    setIsLoading(true);
    setProgress(10);
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    progressTimer.current = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + 5 : p));
    }, 200);
  }

  function back() {
    if (idx <= 0) return;
    const newIdx = idx - 1;
    setIdx(newIdx);
    const entry = hist[newIdx];
    const frame = iframeRef.current;
    if (frame) frame.src = entry.url;
    setAddr(entry.display);
  }

  function forward() {
    if (idx >= hist.length - 1) return;
    const newIdx = idx + 1;
    setIdx(newIdx);
    const entry = hist[newIdx];
    const frame = iframeRef.current;
    if (frame) frame.src = entry.url;
    setAddr(entry.display);
  }

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    function onLoad() {
      try {
        const frameEl = iframeRef.current;
        if (!frameEl) return;
        const win = frameEl.contentWindow;
        const doc = frameEl.contentDocument;
        if (!win || !doc) return;
        const sameOrigin = win.location.origin === window.location.origin;
        if (sameOrigin && win.location.pathname.startsWith("/wiki/")) {
          const rel = win.location.pathname.replace(/^\/wiki\//, "");
          setAddr(rel);
          const last = rel.split("/").pop() || rel;
          const title = decodeURIComponent(last).replace(/\.(html?|htm)$/i, "");
          setMobileTitle(title);
          doc.addEventListener(
            "click",
            (ev) => {
              const target = ev.target as HTMLElement | null;
              const anchor = target?.closest("a") as HTMLAnchorElement | null;
              if (!anchor) return;
              const href = anchor.getAttribute("href") || "";
              if (!href) return;
              ev.preventDefault();
              const url = new URL(href, win.location.href);
              const isExternal = url.origin !== window.location.origin;
              if (isExternal) {
                navigate(url.href);
              } else {
                const p = url.pathname.replace(/^\/wiki\//, "");
                navigate(p + (url.search || "") + (url.hash || ""));
              }
            },
            { capture: true }
          );

          let lastY = win.scrollY;
          const onScroll = () => {
            const y = win.scrollY;
            const dy = y - lastY;
            if (dy < -10) {
              setMobileBarExpanded(true);
            } else if (dy > 10) {
              setMobileBarExpanded(false);
            }
            lastY = y;
          };
          win.addEventListener("scroll", onScroll, { passive: true });
        }
      } catch {}
      setIsLoading(false);
      setProgress(100);
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      window.setTimeout(() => setProgress(0), 300);
      setEditingAddr(false);
    }
    frame.addEventListener("load", onLoad);
    return () => frame.removeEventListener("load", onLoad);
  }, [iframeRef.current, hist, idx]);

  async function runSearch() {
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }

  useEffect(() => {
    const tryHome = async () => {
      const rel = HOME.replace(/^\/+/, "");
      try {
        const r = await fetch(`/wiki/${encodeURI(rel)}`, { method: "HEAD" });
        if (r.ok) {
          navigate(rel);
          return;
        }
      } catch {}
      navigate("zh/index.html");
    };
    tryHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("viewer:sidebarOpen");
      if (saved !== null) setSidebarOpen(saved === "true");
      const w = localStorage.getItem("viewer:sidebarWidth");
      if (w) {
        const num = parseInt(w, 10);
        if (!Number.isNaN(num)) setSidebarWidth(Math.min(Math.max(num, 200), 600));
      }
    } catch {}
  }, []);

  useEffect(() => {
    function computeVp() {
      const w = window.innerWidth;
      const vp = w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
      setViewport(vp);
      if (vp === "mobile") setSidebarOpen(false);
    }
    computeVp();
    window.addEventListener("resize", computeVp);
    return () => window.removeEventListener("resize", computeVp);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("viewer:sidebarOpen", String(sidebarOpen));
    } catch {}
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      localStorage.setItem("viewer:sidebarWidth", String(sidebarWidth));
    } catch {}
  }, [sidebarWidth]);

  // 使用 PointerEvents + pointer capture 以避免进入 iframe 时丢失事件
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!draggingWidth) return;
      const target = resizerRef.current;
      if (!target) return;
      if (e.buttons === 0) { setDraggingWidth(false); try { target.releasePointerCapture(e.pointerId) } catch {} return }
      const x = e.clientX;
      const newW = Math.min(Math.max(x, 200), 600);
      setSidebarWidth(newW);
    }
    function onPointerUp(e: PointerEvent) {
      if (!draggingWidth) return;
      const target = resizerRef.current;
      setDraggingWidth(false);
      try { target?.releasePointerCapture(e.pointerId) } catch {}
    }
    const el = resizerRef.current;
    if (!el) return;
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingWidth, resizerRef.current]);

  useEffect(() => {
    if (editingAddr) addrInputRef.current?.focus();
  }, [editingAddr]);

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (!editingAddr) return;
      const el = addrBoxRef.current;
      if (el && !el.contains(e.target as Node)) setEditingAddr(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [editingAddr]);

  useEffect(() => {
    if (panel === "tree" && tree.length === 0) {
      fetch("/api/tree")
        .then((r) => r.json())
        .then((t) => setTree(t || []))
        .catch(() => setTree([]));
    }
  }, [panel, tree.length]);

  useEffect(() => {
    let aborted = false;
    fetch('/api/tree?flat=1')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((flat) => { if (!aborted) setTreeFiles(flat || []); })
      .catch(() => {
        function flatten(nodes: any[], acc: Array<{ name: string; path: string }>) {
          for (const n of nodes || []) {
            if (n.path) acc.push({ name: n.name, path: n.path });
            if (n.children) flatten(n.children, acc);
          }
        }
        const acc: Array<{ name: string; path: string }> = [];
        flatten(tree, acc);
        if (!aborted) setTreeFiles(acc);
      });
    return () => { aborted = true; };
  }, [tree]);

  useEffect(() => {
    const q = treeQuery.trim();
    if (q.length === 0) { setTreeResults([]); return; }
    const lc = q.toLowerCase();
    const timer = window.setTimeout(() => {
      const res = [...treeFiles].filter((f) => f.name.toLowerCase().includes(lc)).slice(0, 200);
      setTreeResults(res);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [treeQuery, treeFiles]);

  function toggle(pathKey: string) {
    setExpanded((prev) => ({ ...prev, [pathKey]: !prev[pathKey] }));
  }

  function renderNode(node: { name: string; path?: string; children?: any[] }, depth: number, parentKey: string) {
    const key = parentKey ? parentKey + "/" + node.name : node.name;
    const isDir = !!node.children && typeof node.path === "undefined";
    const isOpen = expanded[key] || depth === 0;
    return (
      <div key={key}>
        <div
          className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-zinc-100 cursor-pointer rounded-md select-none"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => (isDir ? toggle(key) : node.path ? navigate(node.path) : null)}
        >
          {isDir ? (isOpen ? <FolderOpenIcon className="w-4 h-4 shrink-0" /> : <FolderIcon className="w-4 h-4 shrink-0" />) : <FileText className="w-4 h-4 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </div>
        {isDir && (
          <div
            className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
            style={{ maxHeight: isOpen ? 2000 : 0 }}
          >
            {isOpen && node.children?.map((c) => renderNode(c, depth + 1, key))}
          </div>
        )}
      </div>
    );
  }

  function displaySeg(seg: string) {
    try {
      return decodeURIComponent(seg);
    } catch {
      return seg;
    }
  }

  function compressSegments(path: string) {
    const parts = path.split("/").filter(Boolean);
    const decoded = parts.map((p) => displaySeg(p));
    if (decoded.length <= 4) {
      return decoded.map((label, i) => ({ label, path: parts.slice(0, i + 1).join("/"), isLast: i === decoded.length - 1 }));
    }
    const first = { label: decoded[0], path: parts.slice(0, 1).join("/"), isLast: false };
    const ellipsis = { label: "…", path: "", isLast: false, isEllipsis: true } as const;
    const penult = { label: decoded[decoded.length - 2], path: parts.slice(0, decoded.length - 1).join("/"), isLast: false };
    const last = { label: decoded[decoded.length - 1], path: parts.join("/"), isLast: true };
    return [first, ellipsis, penult, last];
  }

  return (
    <div className="flex h-screen w-full bg-zinc-50">
      <aside
        className={`hidden md:flex flex-col border-r border-zinc-200 overflow-hidden ${
          sidebarOpen ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: sidebarOpen ? sidebarWidth : 0, transition: draggingWidth ? undefined : "width 300ms ease-out, opacity 300ms ease-out" }}
      >
        <div className="flex items-center gap-2 p-2 border-b border-[var(--btn-border)]">
          {ENABLE_SEARCH && (
            <>
              <button
                className={`px-2 h-[var(--toolbar-height)] text-sm rounded-[var(--radius)] border border-[var(--btn-border)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)] ${panel === "tree" ? "bg-[var(--btn-hover-bg)]" : ""}`}
                onClick={() => setPanel("tree")}
                aria-label="目录"
                title="目录"
              >
                <FolderIcon className="w-4 h-4" />
              </button>
              <button
                className={`px-2 h-[var(--toolbar-height)] text-sm rounded-[var(--radius)] border border-[var(--btn-border)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)] ${panel === "search" ? "bg-[var(--btn-hover-bg)]" : ""}`}
                onClick={() => setPanel("search")}
                aria-label="搜索"
                title="搜索"
              >
                <SearchIcon className="w-4 h-4" />
              </button>
            </>
          )}
          <div className="flex-1" />
          <button
            className="px-2 h-[var(--toolbar-height)] text-sm rounded-[var(--radius)] border border-[var(--btn-border)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]"
            onClick={() => setSidebarOpen(false)}
            aria-label="收起侧边栏"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        {ENABLE_SEARCH && (
          <div className="p-2 border-b border-[var(--btn-border)]">
            {panel === "tree" ? (
              <div className="relative">
                <input
                  className="w-full rounded-[var(--radius)] border border-[var(--input-border)] pl-2 pr-8 h-[var(--toolbar-height)] text-sm"
                  placeholder="按文件名搜索"
                  value={treeQuery}
                  onChange={(e) => setTreeQuery(e.target.value)}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[var(--radius)] hover:bg-[var(--btn-hover-bg)]"
                  aria-label="搜索"
                >
                  <SearchIcon className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className="w-full rounded-[var(--radius)] border border-[var(--input-border)] pl-2 pr-8 h-[var(--toolbar-height)] text-sm"
                  placeholder="输入关键字"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runSearch();
                  }}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[var(--radius)] hover:bg-[var(--btn-hover-bg)]"
                  onClick={runSearch}
                  aria-label="搜索"
                >
                  <SearchIcon className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            )}
            {/* 统计文案移至内容区域，确保分隔线与文件栏目对齐 */}
          </div>
        )}
        {panel === "search" && ENABLE_SEARCH && (
          <div className="flex-1 overflow-auto pr-1 p-2 space-y-3">
            <div className="text-xs text-zinc-500">{loadingSearch ? "搜索中…" : results.length ? `共 ${results.length} 条` : ""}</div>
            {results.map((r) => (
              <div key={r.path} className="border border-[var(--btn-border)] rounded-[var(--radius)] p-2 hover:bg-[var(--btn-hover-bg)] cursor-pointer" onClick={() => navigate(r.path)}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{r.title}</span>
                </div>
                <div className="text-xs text-zinc-600 line-clamp-3">{r.snippet}</div>
              </div>
            ))}
          </div>
        )}
        {panel === "tree" && (
          <div className="flex-1 overflow-auto">
            {treeQuery.trim().length > 0 ? (
              <div className="space-y-1 p-2">
                {treeResults.map((f) => (
                    <div
                      key={f.path}
                      className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-zinc-100 cursor-pointer rounded-md select-none"
                      onClick={() => navigate(f.path)}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="font-medium truncate">{f.name}</span>
                      <span className="text-xs text-zinc-500 truncate">— {f.path}</span>
                    </div>
                  ))}
              </div>
            ) : (
              tree.map((n) => renderNode(n, 0, ""))
            )}
          </div>
        )}
      </aside>
      {sidebarOpen && viewport !== "mobile" && (
        <div
          ref={resizerRef}
          className="w-1 cursor-col-resize bg-transparent hover:bg-zinc-200 active:bg-zinc-300"
          onPointerDown={(e) => {
            setDraggingWidth(true);
            try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {}
          }}
          title="拖动调整侧栏宽度"
        />
      )}
      <main className="flex-1 flex flex-col">
        {!(viewport === "mobile" && MOBILE_BOTTOM) && (
          <div className="flex items-center gap-2 p-2 border-b border-[var(--btn-border)] bg-white">
          {!sidebarOpen && viewport !== "mobile" && (
            <button className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] border border-[var(--btn-border)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]" onClick={() => setSidebarOpen(true)} aria-label="展开侧边栏">
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <button className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] border border-[var(--btn-border)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]" onClick={back} disabled={idx <= 0} aria-label="后退">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] border border-[var(--btn-border)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]" onClick={forward} disabled={idx >= hist.length - 1} aria-label="前进">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] border border-[var(--btn-border)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]"
            onClick={() => {
              const frame = iframeRef.current;
              if (!frame) return;
              try {
                const win = frame.contentWindow;
                if (win) win.location.reload();
              } catch {
                frame.src = frame.src;
              }
            }}
            aria-label="刷新"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] border border-[var(--btn-border)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]" onClick={() => navigate(HOME)} aria-label="主页">
            <Home className="w-4 h-4" />
          </button>
          <div
            ref={addrBoxRef}
            className="flex-1 flex items-center gap-2 rounded-[var(--radius)] border border-[var(--input-border)] px-3 bg-[var(--addr-bg)] h-[var(--toolbar-height)]"
            onClick={() => {
              if (!editingAddr) setEditingAddr(true);
            }}
          >
            {isExternalUrl(addr) ? (
              <ExternalLink className="w-4 h-4 text-zinc-500" />
            ) : addr.endsWith(".html") ? (
              <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
            ) : (
              <FolderIcon className="w-4 h-4 text-zinc-500" />
            )}
            {!editingAddr && !isExternalUrl(addr) && (
              <div className="hidden md:flex items-center gap-1 text-xs text-zinc-600 overflow-hidden">
                {addr.split("/").filter(Boolean).map((seg, i, arr) => {
                  const p = arr.slice(0, i + 1).join("/");
                  const isLast = i === arr.length - 1;
                  return (
                    <button
                      key={p}
                      className={`px-1.5 py-0.5 rounded-[var(--radius)] ${isLast ? "bg-[var(--btn-hover-bg)]" : "hover:bg-[var(--btn-hover-bg)]"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(p);
                      }}
                      title={p}
                    >
                      {displaySeg(seg)}
                    </button>
                  );
                })}
              </div>
            )}
            {editingAddr && (
              <div className="relative flex-1">
                <input
                  ref={addrInputRef}
                  className="w-full bg-transparent outline-none text-sm pr-16"
                  placeholder="相对路径或外链"
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(addr);
                    if (e.key === "Escape") setEditingAddr(false);
                  }}
                />
                {addr && (
                  <button
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-[var(--radius)] hover:bg-[var(--btn-hover-bg)]"
                    onClick={(e) => { e.stopPropagation(); setAddr(""); }}
                    aria-label="清空"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[var(--radius)] bg-black text-white hover:bg-zinc-900"
                  onClick={(e) => { e.stopPropagation(); navigate(addr); }}
                  aria-label="前往"
                >
                  <CornerDownRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          </div>
        )}
        <div className="relative flex-1 bg-white">
          <div className="absolute top-0 left-0 h-0.5 bg-blue-500 transition-all" style={{ width: `${progress}%`, opacity: progress > 0 ? 1 : 0 }} />
          <iframe
            ref={iframeRef}
            className="w-full h-full"
            sandbox="allow-same-origin allow-forms allow-scripts allow-popups allow-modals"
            style={{ pointerEvents: draggingWidth ? "none" : "auto" }}
          />
          {editingAddr && (
            <div
              className="absolute inset-0 bg-transparent"
              style={{ cursor: "default" }}
              onClick={() => setEditingAddr(false)}
            />
          )}
          {isLoading && <div className="absolute inset-0 bg-white/40 pointer-events-none animate-pulse" />}
        </div>
        {viewport === "mobile" && MOBILE_BOTTOM && (
          <div
            className="fixed bottom-0 left-0 right-0 border-t border-[var(--btn-border)] bg-[var(--addr-bg)]"
            style={{ height: mobileBarExpanded ? `calc(var(--toolbar-height) * 2 + 8px)` : `calc(var(--toolbar-height) * 0.75 + 6px)`, transition: `height var(--duration-medium) var(--ease-expressive)` }}
            onClick={() => setMobileBarExpanded((v) => !v)}
          >
            <div className="px-3">
              <div className="relative" style={{ height: mobileBarExpanded ? `var(--toolbar-height)` : `calc(var(--toolbar-height) * 0.75)` }}>
                <div className={`absolute inset-0 flex items-center justify-center ${mobileBarExpanded ? "opacity-0 scale-95" : "opacity-100 scale-100"}`} style={{ transition: `opacity var(--duration-fast) var(--ease-soft), transform var(--duration-fast) var(--ease-soft)` }}>
                  <span className="font-medium truncate text-[13px]">{mobileTitle || displaySeg((addr.split("/").pop() || addr || "页面"))}</span>
                </div>
                <div className={`absolute inset-0 flex items-center justify-center ${mobileBarExpanded ? "opacity-100 scale-105" : "opacity-0 scale-95"}`} style={{ transition: `opacity var(--duration-fast) var(--ease-soft), transform var(--duration-fast) var(--ease-soft)` }}>
                  {!isExternalUrl(addr) && (
                    <div className="flex items-center gap-1 text-[16px] overflow-hidden">
                      {compressSegments(addr).map((item) => (
                        ("isEllipsis" in item && (item as any).isEllipsis) ? (
                          <span key={`ellipsis-${item.label}`} className="px-1.5 py-0.5 text-[var(--text-muted)]">{item.label}</span>
                        ) : (
                          <button
                            key={item.path}
                            className={`px-1.5 py-0.5 rounded-[var(--radius)] ${item.isLast ? "bg-[var(--btn-hover-bg)] text-[var(--foreground)] font-medium" : "hover:bg-[var(--btn-hover-bg)] text-[var(--text-muted)] font-normal"}`}
                            onClick={() => navigate(item.path)}
                            title={item.path}
                          >
                            {item.label}
                          </button>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={`${mobileBarExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"}`} style={{ transition: `opacity var(--duration-medium) var(--ease-soft), transform var(--duration-medium) var(--ease-soft)` }}>
                <div className="flex items-center justify-evenly gap-2 py-[2px]">
                  <button className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]" onClick={back} disabled={idx <= 0} aria-label="后退">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]" onClick={forward} disabled={idx >= hist.length - 1} aria-label="前进">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]" onClick={() => navigate(HOME)} aria-label="主页">
                    <Home className="w-4 h-4" />
                  </button>
                  <button
                    className="px-2 h-[var(--toolbar-height)] rounded-[var(--radius)] hover:bg-[var(--btn-hover-bg)] active:bg-[var(--btn-active-bg)]"
                    onClick={() => {
                      const frame = iframeRef.current;
                      if (!frame) return;
                      try {
                        const win = frame.contentWindow;
                        if (win) win.location.reload();
                      } catch {
                        frame.src = frame.src;
                      }
                    }}
                    aria-label="刷新"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}