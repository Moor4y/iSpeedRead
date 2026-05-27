#!/usr/bin/env python3
"""
Neural TTS via Microsoft Edge (edge-tts).
Reads JSON from stdin:
  { "sentences": ["..."], "voice": "en-US-JennyNeural", "rate": "+0%" }
Writes JSON to stdout:
  { "audioBase64": "...", "mimeType": "audio/mpeg", "timeline": [...], "durationMs": N }
Requires: pip install edge-tts pydub  (+ ffmpeg on PATH for pydub MP3)
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import sys


async def synthesize_sentence(text: str, voice: str, rate: str) -> bytes:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice, rate=rate)
    parts: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            parts.append(chunk["data"])
    return b"".join(parts)


async def run(payload: dict) -> dict:
    from pydub import AudioSegment

    sentences: list[str] = payload.get("sentences") or []
    voice: str = payload["voice"]
    rate: str = payload.get("rate") or "+0%"

    combined = AudioSegment.empty()
    timeline: list[dict] = []
    offset_ms = 0

    for i, sentence in enumerate(sentences):
        text = (sentence or "").strip()
        if not text:
            continue

        mp3_bytes = await synthesize_sentence(text, voice, rate)
        segment = AudioSegment.from_mp3(io.BytesIO(mp3_bytes))
        duration_ms = len(segment)

        timeline.append(
            {
                "sentenceIndex": i,
                "startMs": offset_ms,
                "endMs": offset_ms + duration_ms,
            }
        )
        combined += segment
        offset_ms += duration_ms

    if offset_ms == 0:
        raise ValueError("No speakable sentences in chunk")

    out_buffer = io.BytesIO()
    combined.export(out_buffer, format="mp3")
    audio_b64 = base64.b64encode(out_buffer.getvalue()).decode("ascii")

    return {
        "audioBase64": audio_b64,
        "mimeType": "audio/mpeg",
        "timeline": timeline,
        "voice": voice,
        "durationMs": offset_ms,
    }


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        result = asyncio.run(run(payload))
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except ImportError as e:
        print(str(e), file=sys.stderr)
        print(
            "Install: pip install edge-tts pydub  (and ffmpeg on PATH)",
            file=sys.stderr,
        )
        return 1
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
