import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { getDb, closeDb } from "./db/client.js";
import { adminRouter } from "./routes/admin.js";
import { booksRouter } from "./routes/books.js";
import { uploadRouter } from "./routes/upload.js";
import {
  ensureUploadDir,
  ensureBooksDir,
  ensureWorkbenchDir,
} from "./services/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Walk up from __dirname until we find the project root (contains package.json).
// Works for both dev (server/) and prod (dist/server/).
function findProjectRoot(start: string): string {
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start; // filesystem root fallback
    dir = parent;
  }
}
const projectRoot = findProjectRoot(__dirname);
const clientDist = path.join(projectRoot, "client", "dist");
const adminPublicDir = path.join(projectRoot, "server", "public", "admin");

const app = express();

app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

ensureUploadDir();
ensureBooksDir();
ensureWorkbenchDir();
getDb();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/upload", uploadRouter);
app.use("/api/books", booksRouter);
app.use("/api/admin", adminRouter);

if (fs.existsSync(adminPublicDir)) {
  app.use("/admin/static", express.static(adminPublicDir));
  app.get("/admin", (_req, res) => {
    res.sendFile(path.join(adminPublicDir, "index.html"));
  });
}

// Serve the built PWA client for all non-API routes.
// In dev mode the client/dist folder may not exist yet — skip gracefully.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*splat", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    if (err.message.includes("Only EPUB and PDF")) {
      res.status(400).json({ error: err.message });
      return;
    }
    if ((err as { code?: string }).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File too large (max 100MB)" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
);

const server = app.listen(config.port, config.host, () => {
  console.log(
    `iSpeedRead library server listening on http://${config.host}:${config.port}`
  );
});

function shutdown() {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
