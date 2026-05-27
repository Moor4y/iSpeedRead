import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../config.js";
import type { TtsLang, TtsPayload, TtsVoice } from "../types/tts.js";
import { TTS_DEFAULT_VOICE, TTS_SERVER_RATE, TTS_VOICE_OPTIONS } from "../types/tts.js";

interface PythonTtsResult {
  audioBase64: string;
  mimeType: string;
  timeline: TtsPayload["timeline"];
  voice: string;
  durationMs: number;
}

/** Validate that a voice string is one of the known voices for the given lang. */
export function resolveVoice(lang: TtsLang, voiceParam?: string): TtsVoice {
  if (voiceParam) {
    const match = TTS_VOICE_OPTIONS.find(
      (o) => o.voice === voiceParam && o.lang === lang
    );
    if (match) return match.voice;
  }
  return TTS_DEFAULT_VOICE[lang];
}

/**
 * Cache path includes the voice name so different voices for the same chunk
 * are stored independently.
 */
function ttsCachePath(
  bookId: string,
  chunkIndex: number,
  voice: TtsVoice
): string {
  return path.join(config.ttsCacheDir, bookId, `${chunkIndex}_${voice}.json`);
}

function ensureTtsCacheDir(bookId: string): void {
  fs.mkdirSync(path.join(config.ttsCacheDir, bookId), { recursive: true });
}

export function readTtsCache(
  bookId: string,
  chunkIndex: number,
  voice: TtsVoice
): TtsPayload | null {
  const filePath = ttsCachePath(bookId, chunkIndex, voice);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as TtsPayload;
  } catch {
    return null;
  }
}

function writeTtsCache(payload: TtsPayload): void {
  ensureTtsCacheDir(payload.bookId);
  const filePath = ttsCachePath(payload.bookId, payload.chunkIndex, payload.voice);
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

    proc.stdin.write(JSON.stringify({ sentences, voice, rate }));
    proc.stdin.end();
  });
}

export async function synthesizeChunkTts(
  bookId: string,
  chunkIndex: number,
  sentences: string[],
  lang: TtsLang,
  voice: TtsVoice
): Promise<TtsPayload> {
  const cached = readTtsCache(bookId, chunkIndex, voice);
  if (cached) return cached;

  // Bake 2× speed into the server-side synthesis so the client only needs
  // to apply up to 2× locally to reach a combined 4× maximum.
  const result = await spawnTtsPython(sentences, voice, TTS_SERVER_RATE);

  const payload: TtsPayload = {
    bookId,
    chunkIndex,
    voice,
    lang,
    audioBase64: result.audioBase64,
    mimeType: result.mimeType,
    timeline: result.timeline,
    durationMs: result.durationMs,
  };

  writeTtsCache(payload);
  return payload;
}
