import fs from "node:fs";
import { spawn } from "node:child_process";
import pdfParse from "pdf-parse";
import { config } from "../../config.js";
import type { ParseResult } from "../../types/book.js";
import {
  chunkText,
  chunkTextWithChapterBoundaries,
  mergeAndReindexChunkSections,
} from "../chunker.js";
import { filenameStem } from "../storage.js";

interface PdfChapterPayload {
  title: string;
  text: string;
}

interface PdfChapterDetectResult {
  title?: string;
  author?: string;
  detectionMethod?: string;
  warnings?: string[];
  chapters: PdfChapterPayload[];
}

function spawnPdfChapterDetect(
  filePath: string
): Promise<PdfChapterDetectResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      config.pythonPath,
      [config.pdfChapterScriptPath, filePath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error("PDF chapter detection timed out"));
    }, config.academicTimeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Failed to run PDF chapter script (${config.pythonPath}): ${err.message}`
        )
      );
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        const detail = stderr.trim().slice(0, 500);
        reject(
          new Error(
            `PDF chapter detection failed (exit ${code})${detail ? `: ${detail}` : ""}`
          )
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout) as PdfChapterDetectResult);
      } catch (err) {
        reject(
          new Error(
            `Invalid JSON from PDF chapter script: ${err instanceof Error ? err.message : String(err)}`
          )
        );
      }
    });
  });
}

function buildChunksFromChapterSections(
  chapters: PdfChapterPayload[]
): ParseResult["chunks"] {
  const sections = chapters
    .filter((chapter) => chapter.text.trim())
    .map((chapter) =>
      chunkText(chapter.text, undefined, chapter.title.trim(), false)
    );

  return mergeAndReindexChunkSections(sections);
}

async function parsePdfWithChapterDetection(
  filePath: string,
  originalFilename: string
): Promise<ParseResult> {
  const parsed = await spawnPdfChapterDetect(filePath);

  if (!parsed.chapters?.length) {
    throw new Error("PDF chapter detector returned no chapters");
  }

  const title =
    parsed.title?.trim() || filenameStem(originalFilename);
  const author = parsed.author?.trim() || "Unknown Author";
  const chunks = buildChunksFromChapterSections(parsed.chapters);

  if (chunks.length === 0) {
    throw new Error("PDF contains no extractable text");
  }

  if (parsed.warnings?.length) {
    console.warn(
      `PDF ingest warnings (${parsed.detectionMethod ?? "unknown"}):`,
      parsed.warnings.join("; ")
    );
  }

  return { title, author, chunks };
}

async function parsePdfFallback(
  filePath: string,
  originalFilename: string
): Promise<ParseResult> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  const title =
    data.info?.Title?.trim() || filenameStem(originalFilename);
  const author = data.info?.Author?.trim() || "Unknown Author";
  const fullText = (data.text ?? "").trim();

  if (!fullText) {
    throw new Error("PDF contains no extractable text");
  }

  console.warn(
    "PDF chapter detection unavailable; using text-only fallback parser"
  );

  return {
    title,
    author,
    chunks: chunkTextWithChapterBoundaries(fullText, "Document"),
  };
}

export async function parsePdfBasic(
  filePath: string,
  originalFilename: string
): Promise<ParseResult> {
  try {
    return await parsePdfWithChapterDetection(filePath, originalFilename);
  } catch (err) {
    console.error("PDF chapter detection failed, using fallback:", err);
    return parsePdfFallback(filePath, originalFilename);
  }
}

export async function parsePdfAcademic(
  filePath: string,
  originalFilename: string
): Promise<ParseResult> {
  return parsePdfBasic(filePath, originalFilename);
}
