import { useEffect, useRef } from "react";
import type { Chunk } from "../types";

interface ChunkPanelProps {
  chunk: Chunk | null;
  loading?: boolean;
  /** Phase 3 will drive this from TTS; null = no focal line yet */
  activeSentenceIndex?: number | null;
}

export function ChunkPanel({
  chunk,
  loading,
  activeSentenceIndex = null,
}: ChunkPanelProps) {
  const sentenceRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    if (activeSentenceIndex === null || activeSentenceIndex === undefined) {
      return;
    }
    const el = sentenceRefs.current[activeSentenceIndex];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSentenceIndex, chunk?.index]);

  if (loading && !chunk) {
    return (
      <div className="reading-column chunk-panel">
        <p className="chunk-panel__status">Loading…</p>
      </div>
    );
  }

  if (!chunk) {
    return (
      <div className="reading-column chunk-panel">
        <p className="chunk-panel__status">Unavailable offline</p>
      </div>
    );
  }

  return (
    <div className="reading-column chunk-panel">
      {chunk.sentences.map((sentence, i) => {
        const isFocal =
          activeSentenceIndex !== null && i === activeSentenceIndex;
        const isDimmed =
          activeSentenceIndex !== null && i !== activeSentenceIndex;

        return (
          <p
            key={`${chunk.index}-${i}`}
            ref={(el) => {
              sentenceRefs.current[i] = el;
            }}
            className={[
              "sentence",
              isFocal ? "sentence--focal" : "",
              isDimmed ? "sentence--dimmed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {sentence}
          </p>
        );
      })}
    </div>
  );
}
