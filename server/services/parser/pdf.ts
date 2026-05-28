import fs from "node:fs";
import { spawn } from "node:child_process";
import pdfParse from "pdf-parse";
import { config } from "../../config.js";
import type { ParseResult } from "../../types/book.js";
import type { AdminLang } from "../../types/admin.js";
import type { ParseLangHint } from "./index.js";
import {
  chunkText,
  chunkTextWithChapterBoundaries,
  mergeAndReindexChunkSections,
} from "../chunker.js";
import { filenameStem } from "../storage.js";
import { detectAdminLangFromText } from "../lang.js";

const ARCHIVE_LINE_PATTERN =
  /(Digitized by the Internet Archive|archive\.org\/details)/i;

function countMatches(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0;
}

function normalizeZhSpacing(line: string): string {
  return line
    .replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, "$1")
    .replace(/\s+([，。！？：；、）】》”’])/gu, "$1")
    .replace(/([（【《“‘])\s+/gu, "$1");
}

function shouldDropNoisyLine(
  line: string,
  lang: AdminLang,
  strictOcrCleanup: boolean
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (ARCHIVE_LINE_PATTERN.test(trimmed)) return true;
  if (/^(?:page|p\.)?\s*\d{1,4}$/i.test(trimmed)) return true;
  if (/^[^\p{L}\p{N}]{3,}$/u.test(trimmed)) return true;

  if (lang === "zh") {
    const len = Math.max(1, Array.from(trimmed).length);
    const cjk = countMatches(trimmed, /[\p{Script=Han}]/gu);
    const latin = countMatches(trimmed, /[A-Za-z]/g);
    const symbols = countMatches(trimmed, /[^\p{L}\p{N}\s]/gu);
    const cjkRatio = cjk / len;
    const latinRatio = latin / len;
    const symbolRatio = symbols / len;

    // Typical OCR garbage for CJK books: high latin/symbol noise and near-zero CJK.
    const latinThreshold = strictOcrCleanup ? 0.35 : 0.45;
    const symbolThreshold = strictOcrCleanup ? 0.28 : 0.35;
    const cjkLowThreshold = strictOcrCleanup ? 0.16 : 0.12;
    if (cjkRatio < 0.08 && latinRatio > latinThreshold) return true;
    if (
      cjkRatio < cjkLowThreshold &&
      symbolRatio > symbolThreshold &&
      latinRatio > 0.2
    )
      return true;
    if (cjk === 0 && len < 8) return true;
  }

  return false;
}

function minimallyNormalizeText(text: string, lang: AdminLang): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  if (lang !== "zh") return normalized;
  return normalized
    .split("\n")
    .map((line) => normalizeZhSpacing(line))
    .join("\n");
}

function cleanPdfChapterText(
  rawText: string,
  lang: AdminLang,
  strictOcrCleanup: boolean
): string {
  const normalized = minimallyNormalizeText(rawText, lang);
  const lines = normalized.split("\n");
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const maybeZh = lang === "zh" ? normalizeZhSpacing(line) : line.trimEnd();
    if (shouldDropNoisyLine(maybeZh, lang, strictOcrCleanup)) continue;
    cleanedLines.push(maybeZh.trim());
  }

  const cleaned = cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Safety: if cleaning is too aggressive, keep minimally normalized text.
  if (!cleaned || cleaned.length < normalized.length * 0.25) {
    return normalized.trim();
  }
  return cleaned;
}

interface PdfChapterPayload {
  title: string;
  text: string;
}

interface PdfChapterDetectResult {
  title?: string;
  author?: string;
  detectedLang?: AdminLang;
  detectionMethod?: string;
  warnings?: string[];
  chapters: PdfChapterPayload[];
}

export interface PdfParseOptions {
  strictOcrCleanup?: boolean;
}

function spawnPdfChapterDetect(
  filePath: string,
  lang: ParseLangHint
): Promise<PdfChapterDetectResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      config.pythonPath,
      [config.pdfChapterScriptPath, filePath, "--lang", lang],
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
  chapters: PdfChapterPayload[],
  lang: AdminLang,
  options: PdfParseOptions
): ParseResult["chunks"] {
  const sections = chapters
    .map((chapter) => ({
      title:
        lang === "zh" && chapter.title.trim().toLowerCase() === "full book"
          ? "文档"
          : chapter.title.trim(),
      text: cleanPdfChapterText(
        chapter.text,
        lang,
        options.strictOcrCleanup === true
      ),
    }))
    .filter((chapter) => chapter.text.trim())
    .map((chapter) =>
      chunkText(chapter.text, undefined, chapter.title || null, false)
    );

  return mergeAndReindexChunkSections(sections);
}

async function parsePdfWithChapterDetection(
  filePath: string,
  originalFilename: string,
  lang: ParseLangHint,
  options: PdfParseOptions
): Promise<ParseResult> {
  const parsed = await spawnPdfChapterDetect(filePath, lang);

  if (!parsed.chapters?.length) {
    throw new Error("PDF chapter detector returned no chapters");
  }

  const title =
    parsed.title?.trim() || filenameStem(originalFilename);
  const author = parsed.author?.trim() || "Unknown Author";
  const resolvedLang: AdminLang =
    lang === "auto"
      ? parsed.detectedLang ??
        detectAdminLangFromText(parsed.chapters.map((c) => c.text).join("\n"))
      : lang;
  const chunks = buildChunksFromChapterSections(
    parsed.chapters,
    resolvedLang,
    options
  );

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
  originalFilename: string,
  lang: ParseLangHint,
  options: PdfParseOptions
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

  const resolvedLang =
    lang === "auto" ? detectAdminLangFromText(fullText) : lang;
  const cleaned = cleanPdfChapterText(
    fullText,
    resolvedLang,
    options.strictOcrCleanup === true
  );

  return {
    title,
    author,
    chunks: chunkTextWithChapterBoundaries(
      cleaned,
      resolvedLang === "zh" ? "文档" : "Document"
    ),
  };
}

export async function parsePdfBasic(
  filePath: string,
  originalFilename: string,
  lang: ParseLangHint = "auto",
  options: PdfParseOptions = {}
): Promise<ParseResult> {
  try {
    return await parsePdfWithChapterDetection(
      filePath,
      originalFilename,
      lang,
      options
    );
  } catch (err) {
    console.error("PDF chapter detection failed, using fallback:", err);
    return parsePdfFallback(filePath, originalFilename, lang, options);
  }
}

export async function parsePdfAcademic(
  filePath: string,
  originalFilename: string,
  lang: ParseLangHint = "auto",
  options: PdfParseOptions = {}
): Promise<ParseResult> {
  return parsePdfBasic(filePath, originalFilename, lang, options);
}
