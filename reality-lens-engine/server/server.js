// Pure Node static file server (no extra frameworks) per blueprint.
const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 8080;
const root = path.join(__dirname, "../client");

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  let filePath = req.url.split("?")[0];
  if (filePath === "/" || filePath === "") filePath = "/index.html";
  const fullPath = path.join(root, filePath);
  if (!fullPath.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.stat(fullPath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    fs.readFile(fullPath, (e, data) => {
      if (e) {
        res.writeHead(500);
        return res.end("Error");
      }
      res.writeHead(200, {
        "Content-Type": contentType(fullPath),
        "Cache-Control": "no-cache",
      });
      res.end(data);
    });
  });
});

server.listen(PORT, () =>
  console.log("RealityLens static server running on :" + PORT),
);
