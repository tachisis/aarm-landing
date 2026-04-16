import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

const ROOT = join(process.cwd(), "dist");
const PORT = Number(process.env.PORT || 3000);

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
]);

function safePath(urlPath) {
  const raw = urlPath.split("?")[0].split("#")[0];
  const decoded = decodeURIComponent(raw);
  const withIndex = decoded.endsWith("/") ? decoded + "index.html" : decoded;
  const p = normalize(withIndex).replace(/^(\.\.[/\\])+/, "");
  return join(ROOT, p);
}

function pickEncoding(req) {
  const ae = String(req.headers["accept-encoding"] || "");
  if (/\bbr\b/.test(ae)) return "br";
  if (/\bgzip\b/.test(ae)) return "gzip";
  return null;
}

createServer((req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }

    const filePath = safePath(req.url);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME.get(ext) || "application/octet-stream";
    const encoding = pickEncoding(req);

    // Only compress text-like assets; images/fonts are already compressed.
    const shouldCompress =
      encoding && (ext === ".html" || ext === ".css" || ext === ".js" || ext === ".json" || ext === ".svg");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Vary", "Accept-Encoding");

    if (!shouldCompress) {
      res.writeHead(200);
      createReadStream(filePath).pipe(res);
      return;
    }

    const buf = readFileSync(filePath);

    if (encoding === "br") {
      res.setHeader("Content-Encoding", "br");
      res.writeHead(200);
      res.end(brotliCompressSync(buf));
      return;
    }

    res.setHeader("Content-Encoding", "gzip");
    res.writeHead(200);
    res.end(gzipSync(buf));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Server error");
  }
}).listen(PORT, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`LH server running on http://127.0.0.1:${PORT}/`);
});

