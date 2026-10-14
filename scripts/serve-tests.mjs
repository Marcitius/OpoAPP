// Local static server for browser tests; production deployment remains Cloudflare Pages.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("out"),
  port = Number(process.env.TEST_STATIC_PORT ?? 3001);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
http
  .createServer((req, res) => {
    let target = path.resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (fs.statSync(target).isDirectory())
        target = path.join(target, "index.html");
      res.setHeader(
        "Content-Type",
        mime[path.extname(target)] ?? "application/octet-stream",
      );
      fs.createReadStream(target)
        .on("error", () => {
          res.writeHead(404);
          res.end();
        })
        .pipe(res);
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`Test server on ${port}`));
