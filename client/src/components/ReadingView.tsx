import { useCallback, useEffect, useState } from "react";
import { useTripleBuffer } from "../hooks/useTripleBuffer";
import { useTtsPlayback } from "../hooks/useTtsPlayback";
import type { BookMetadata, TtsLang, TtsVoice } from "../types";
import { TTS_DEFAULT_VOICE } from "../types";
import { loadTtsPrefs, updateTtsPrefs, setVoiceForLang } from "../tts/prefs";
import { ReadingHeader } from "./ReadingHeader";
import { TripleBufferViewport } from "./TripleBufferViewport";
import "./ReadingView.css";

interface ReadingViewProps {
  book: BookMetadata;
  onBack: () => void;
  onOpenSettings: () => void;
}

export function ReadingView({ book, onBack, onOpenSettings }: ReadingViewProps) {
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [lang, setLang] = useState<TtsLang>("en");
  const [voiceByLang, setVoiceByLang] = useState<Record<TtsLang, TtsVoice>>(
    { ...TTS_DEFAULT_VOICE }
  );
  const [clientRate, setClientRate] = useState(1);

  // Load persisted prefs on mount
  useEffect(() => {
    loadTtsPrefs().then((prefs) => {
      setLang(prefs.lang);
      setVoiceByLang(prefs.voiceByLang);
      setClientRate(prefs.clientRate);
    }).catch(() => {/* use defaults */});
  }, []);

  const voice = voiceByLang[lang];

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
    voice,
    clientRate,
    enabled: ttsEnabled,
    onPageEnd: handlePageEnd,
  });

  // Space bar shortcut
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
    void updateTtsPrefs({ lang: nextLang });
  };

  const handleVoiceChange = (nextVoice: TtsVoice) => {
    setVoiceByLang((prev) => ({ ...prev, [lang]: nextVoice }));
    stopTts();
    void setVoiceForLang(lang, nextVoice);
  };

  const handleClientRateChange = (rate: number) => {
    setClientRate(rate);
    void updateTtsPrefs({ clientRate: rate });
  };

  const handleToggleEnabled = () => {
    setTtsEnabled((v) => {
      if (v) stopTts();
      return !v;
    });
  };

  return (
    <div className="reading-view">
      <ReadingHeader
        book={book}
        currentChunk={current}
        chunkIndex={index}
        onBack={onBack}
        onOpenSettings={onOpenSettings}
        tts={{
          enabled: ttsEnabled,
          onToggleEnabled: handleToggleEnabled,
          isPlaying,
          isLoading: ttsLoading,
          onTogglePlay: togglePlay,
          onStop: () => {
            stopTts();
            setTtsEnabled(false);
          },
          lang,
          onLangChange: handleLangChange,
          voice,
          onVoiceChange: handleVoiceChange,
          clientRate,
          onClientRateChange: handleClientRateChange,
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
