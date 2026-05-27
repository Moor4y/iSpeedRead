import { useCallback, useEffect, useRef, useState } from "react";
import type { Chunk, TtsLang, TtsVoice } from "../types";
import {
  base64ToBlob,
  findActiveSentenceIndex,
  loadTtsPayload,
  prefetchTts,
} from "../tts/buffer";

interface UseTtsPlaybackOptions {
  bookId: string;
  chunk: Chunk | null;
  nextChunkIndex: number | null;
  lang: TtsLang;
  voice: TtsVoice;
  /** Client-side playback rate (1 = normal). Combined with server 2× = effective rate. */
  clientRate: number;
  enabled: boolean;
  onPageEnd?: () => void;
}

export function useTtsPlayback({
  bookId,
  chunk,
  nextChunkIndex,
  lang,
  voice,
  clientRate,
  enabled,
  onPageEnd,
}: UseTtsPlaybackOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const shouldResumeRef = useRef(false);
  const chunkIndexRef = useRef<number | null>(null);

  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revokeUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setActiveSentenceIndex(null);
  }, []);

  const loadAndPlay = useCallback(
    async (targetChunk: Chunk) => {
      setIsLoading(true);
      setError(null);
      stop();
      revokeUrl();

      try {
        const payload = await loadTtsPayload(
          bookId,
          targetChunk.index,
          lang,
          voice
        );

        if (nextChunkIndex !== null) {
          prefetchTts(bookId, nextChunkIndex, lang, voice);
        }

        const blob = base64ToBlob(payload.audioBase64, payload.mimeType);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;

        audio.src = url;
        audio.playbackRate = clientRate;
        audio.onended = () => {
          setIsPlaying(false);
          setActiveSentenceIndex(null);
          onPageEnd?.();
        };
        audio.ontimeupdate = () => {
          const idx = findActiveSentenceIndex(
            payload.timeline,
            audio.currentTime
          );
          setActiveSentenceIndex(idx);
        };

        await audio.play();
        setIsPlaying(true);
        shouldResumeRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "TTS failed");
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    },
    [bookId, lang, voice, nextChunkIndex, onPageEnd, clientRate, revokeUrl, stop]
  );

  // Keep playback rate in sync without reloading audio
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = clientRate;
    }
  }, [clientRate]);

  // React to chunk changes and enabled toggle
  useEffect(() => {
    if (!enabled || !chunk) {
      stop();
      revokeUrl();
      shouldResumeRef.current = false;
      return;
    }

    if (nextChunkIndex !== null) {
      prefetchTts(bookId, nextChunkIndex, lang, voice);
    }

    const indexChanged =
      chunkIndexRef.current !== null && chunkIndexRef.current !== chunk.index;
    chunkIndexRef.current = chunk.index;

    if (enabled && shouldResumeRef.current && indexChanged) {
      void loadAndPlay(chunk);
    }
  }, [bookId, chunk, enabled, lang, voice, loadAndPlay, nextChunkIndex, revokeUrl, stop]);

  useEffect(() => {
    if (!enabled) {
      shouldResumeRef.current = false;
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      revokeUrl();
      audioRef.current = null;
    };
  }, [revokeUrl, stop]);

  const togglePlay = useCallback(() => {
    if (!chunk || !enabled) return;

    const audio = audioRef.current;
    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (audio && objectUrlRef.current) {
      void audio.play();
      setIsPlaying(true);
      return;
    }

    void loadAndPlay(chunk);
  }, [chunk, enabled, isPlaying, loadAndPlay]);

  return {
    activeSentenceIndex: enabled ? activeSentenceIndex : null,
    isPlaying,
    isLoading,
    error,
    togglePlay,
    stop,
  };
}
