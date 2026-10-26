import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.VRT_PORT || 6007);
const BASE_DIR = path.resolve(process.cwd(), "storybook-static");

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

const server = http.createServer((req, res) => {
  const urlPath = req.url ? req.url.split("?")[0] : "/";
  let safePath = path
    .normalize(decodeURIComponent(urlPath))
    .replace(/^(\.\.[/\\])+/, "");
  if (safePath === "/" || safePath === "") {
    safePath = "/index.html";
  }

  const filePath = path.join(BASE_DIR, safePath);

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
    stream.pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Storybook static server running on http://127.0.0.1:${PORT}`);
});
