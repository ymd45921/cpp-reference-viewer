import path from "node:path";

export const BLOCK_ANALYTICS = (process.env.WIKI_BLOCK_ANALYTICS as string) === "true";

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

export function sanitizeHtml(buf: Buffer): Buffer {
  let s = buf.toString("utf-8");
  const stub = `<script>(function(){try{window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){}}catch(e){}})();</script>`;
  s = s.replace(/<head[^>]*>/i, (m) => m + stub);
  s = s.replace(/<script([^>]*?)src=["']https?:\/\/[^"']*(googletagmanager|google-analytics)[^"']*["']([^>]*)><\/script>/gi, '<script$1 type="text/plain" data-blocked="analytics"$2><\/script>');
  s = s.replace(/<script(\s[^>]*)?>[\s\S]*?(gtag\(|dataLayer|googletagmanager)[\s\S]*?<\/script>/gi, '<script$1>(function(){/* analytics blocked */})()<\/script>');
  return Buffer.from(s, "utf-8");
}