import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../config.js";
import type { TtsLang, TtsPayload } from "../types/tts.js";
import { TTS_VOICES } from "../types/tts.js";

interface PythonTtsResult {
  audioBase64: string;
  mimeType: string;
  timeline: TtsPayload["timeline"];
  voice: string;
  durationMs: number;
}

function ttsCachePath(
  bookId: string,
  chunkIndex: number,
  lang: TtsLang
): string {
  return path.join(
    config.ttsCacheDir,
    bookId,
    `${chunkIndex}_${lang}.json`
  );
}

function ensureTtsCacheDir(bookId: string): void {
  fs.mkdirSync(path.join(config.ttsCacheDir, bookId), { recursive: true });
}

export function readTtsCache(
  bookId: string,
  chunkIndex: number,
  lang: TtsLang
): TtsPayload | null {
  const filePath = ttsCachePath(bookId, chunkIndex, lang);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as TtsPayload;
  } catch {
    return null;
  }
}

function writeTtsCache(payload: TtsPayload): void {
  ensureTtsCacheDir(payload.bookId);
  const filePath = ttsCachePath(payload.bookId, payload.chunkIndex, payload.lang);
  fs.writeFileSync(filePath, JSON.stringify(payload), "utf-8");
}

function spawnTtsPython(
  sentences: string[],
  voice: string,
  rate: string
): Promise<PythonTtsResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.pythonPath, [config.ttsScriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error("TTS synthesis timed out"));
    }, config.ttsTimeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(`Failed to run TTS script (${config.pythonPath}): ${err.message}`)
      );
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0) {
        const detail = stderr.trim().slice(0, 500);
        reject(
          new Error(
            `TTS synthesis failed (exit ${code})${detail ? `: ${detail}` : ""}`
          )
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout) as PythonTtsResult);
      } catch (err) {
        reject(
          new Error(
            `Invalid TTS JSON: ${err instanceof Error ? err.message : String(err)}`
          )
        );
      }
    });

    proc.stdin.write(
      JSON.stringify({ sentences, voice, rate: rate || "+0%" })
    );
    proc.stdin.end();
  });
}

export async function synthesizeChunkTts(
  bookId: string,
  chunkIndex: number,
  sentences: string[],
  lang: TtsLang
): Promise<TtsPayload> {
  const cached = readTtsCache(bookId, chunkIndex, lang);
  if (cached) return cached;

  const voice = TTS_VOICES[lang];
  const result = await spawnTtsPython(sentences, voice, "+0%");

  const payload: TtsPayload = {
    bookId,
    chunkIndex,
    voice: result.voice,
    lang,
    audioBase64: result.audioBase64,
    mimeType: result.mimeType,
    timeline: result.timeline,
    durationMs: result.durationMs,
  };

  writeTtsCache(payload);
  return payload;
}
