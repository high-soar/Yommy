import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_PORT = Number(process.env.VRT_PORT || 6007);
const DEFAULT_BASE_DIR = path.resolve(process.cwd(), "storybook-static");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

/**
 * Storybook 静的配信 HTTP サーバーを生成する (R1-39)
 *
 * @param {import("./serve-storybook.d.mts").CreateStorybookServerOptions} [options]
 * @returns {http.Server}
 */
export function createStorybookServer(options = {}) {
  const baseDir = path.resolve(options.baseDir || DEFAULT_BASE_DIR);

  const server = http.createServer((req, res) => {
    req.on("error", (err) => {
      console.warn("[serve-storybook] Request error:", err);
      if (!res.headersSent) {
        res.statusCode = 400;
      }
      res.end();
    });

    let safePath;
    try {
      const urlPath = req.url ? req.url.split("?")[0] : "/";
      safePath = path
        .normalize(decodeURIComponent(urlPath))
        .replace(/^(\.\.[/\\])+/, "");
    } catch {
      // 不正な URI エンコード（例: %E0%A4%A）時のハンドリング (R1-39)
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    if (safePath === "/" || safePath === "") {
      safePath = "/index.html";
    }

    const filePath = path.join(baseDir, safePath);

    // baseDir 外へのパストラバーサル防止ガード
    if (!filePath.startsWith(baseDir)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      const stream = fs.createReadStream(filePath);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.statusCode = 500;
        }
        res.end();
      });
      res.on("error", () => {
        stream.destroy();
      });
      res.on("close", () => {
        stream.destroy();
      });
      stream.pipe(res);
    });
  });

  server.on("error", (err) => {
    console.error("[serve-storybook] Server error:", err);
  });

  return server;
}

// 直接実行された場合の自動リスン
const isMain =
  Boolean(process.argv[1]) &&
  (import.meta.url === `file://${path.resolve(process.argv[1])}` ||
    process.argv[1].endsWith("serve-storybook.mjs"));

if (isMain) {
  const server = createStorybookServer();
  server.listen(DEFAULT_PORT, "127.0.0.1", () => {
    console.log(
      `Storybook static server running on http://127.0.0.1:${DEFAULT_PORT}`,
    );
  });
}
