import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { getDb, closeDb } from "./db/client.js";
import { booksRouter } from "./routes/books.js";
import { uploadRouter } from "./routes/upload.js";
import { ensureUploadDir } from "./services/storage.js";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

ensureUploadDir();
getDb();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/upload", uploadRouter);
app.use("/api/books", booksRouter);

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
