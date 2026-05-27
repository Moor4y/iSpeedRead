import { useCallback, useEffect, useState } from "react";
import { useTripleBuffer } from "../hooks/useTripleBuffer";
import { useTtsPlayback } from "../hooks/useTtsPlayback";
import type { BookMetadata, TtsLang } from "../types";
import { ReadingHeader } from "./ReadingHeader";
import { TripleBufferViewport } from "./TripleBufferViewport";
import "./ReadingView.css";

interface ReadingViewProps {
  book: BookMetadata;
  onBack: () => void;
}

export function ReadingView({ book, onBack }: ReadingViewProps) {
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [lang, setLang] = useState<TtsLang>("en");
  const [playbackRate, setPlaybackRate] = useState(1);

  const {
    prev,
    current,
    next,
    index,
    loading,
    error,
    canGoPrev,
    canGoNext,
    goNext,
    goPrev,
    reload,
  } = useTripleBuffer(book);

  const nextChunkIndex = canGoNext ? index + 1 : null;

  const handlePageEnd = useCallback(() => {
    if (canGoNext) goNext();
  }, [canGoNext, goNext]);

  const {
    activeSentenceIndex,
    isPlaying,
    isLoading: ttsLoading,
    error: ttsError,
    togglePlay,
    stop: stopTts,
  } = useTtsPlayback({
    bookId: book.bookId,
    chunk: current,
    nextChunkIndex,
    lang,
    playbackRate,
    enabled: ttsEnabled,
    onPageEnd: handlePageEnd,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && ttsEnabled) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, ttsEnabled]);

  const handleLangChange = (nextLang: TtsLang) => {
    setLang(nextLang);
    stopTts();
  };

  return (
    <div className="reading-view">
      <ReadingHeader
        book={book}
        currentChunk={current}
        chunkIndex={index}
        onBack={onBack}
        tts={{
          enabled: ttsEnabled,
          onToggleEnabled: () => {
            setTtsEnabled((v) => {
              if (v) stopTts();
              return !v;
            });
          },
          isPlaying,
          isLoading: ttsLoading,
          onTogglePlay: togglePlay,
          lang,
          onLangChange: handleLangChange,
          playbackRate,
          onPlaybackRateChange: setPlaybackRate,
          error: ttsError,
        }}
      />

      {error && (
        <div className="reading-view__error reading-column">
          <p>{error}</p>
          <button type="button" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      <TripleBufferViewport
        prev={prev}
        current={current}
        next={next}
        loading={loading}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={goPrev}
        onNext={goNext}
        activeSentenceIndex={activeSentenceIndex}
        ttsCaptureSpace={ttsEnabled}
      />
    </div>
  );
}
