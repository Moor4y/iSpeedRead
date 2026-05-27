import fs from "node:fs";
import { spawn } from "node:child_process";
import pdfParse from "pdf-parse";
import { config } from "../../config.js";
import type { ParseResult } from "../../types/book.js";
import { chunkText } from "../chunker.js";
import { filenameStem } from "../storage.js";

interface AcademicExtractResult {
  text: string;
  title?: string;
  author?: string;
}

export async function parsePdfBasic(
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

  return {
    title,
    author,
    chunks: chunkText(fullText),
  };
}

export function parsePdfAcademic(
  filePath: string,
  originalFilename: string
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      config.pythonPath,
      [config.academicScriptPath, filePath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error("Academic PDF extraction timed out"));
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
          `Failed to run Python extractor (${config.pythonPath}): ${err.message}`
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
            `Academic PDF extraction failed (exit ${code})${detail ? `: ${detail}` : ""}`
          )
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as AcademicExtractResult;
        const fullText = (parsed.text ?? "").trim();
        if (!fullText) {
          reject(new Error("Academic extractor returned empty text"));
          return;
        }

        resolve({
          title:
            parsed.title?.trim() || filenameStem(originalFilename),
          author: parsed.author?.trim() || "Unknown Author",
          chunks: chunkText(fullText),
        });
      } catch (err) {
        reject(
          new Error(
            `Invalid JSON from academic extractor: ${err instanceof Error ? err.message : String(err)}`
          )
        );
      }
    });
  });
}
