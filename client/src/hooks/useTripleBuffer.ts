import { useCallback, useEffect, useState } from "react";
import {
  ensureChunk,
  initBookCache,
  loadReaderCache,
  prefetchWindow,
  setCheckpoint,
} from "../cache";
import type { BookMetadata, Chunk } from "../types";

interface TripleBufferState {
  prev: Chunk | null;
  current: Chunk | null;
  next: Chunk | null;
  index: number;
  loading: boolean;
  error: string | null;
}

export function useTripleBuffer(book: BookMetadata) {
  const [state, setState] = useState<TripleBufferState>({
    prev: null,
    current: null,
    next: null,
    index: 0,
    loading: true,
    error: null,
  });

  const loadWindow = useCallback(
    async (index: number) => {
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const [prev, current, next] = await Promise.all([
          ensureChunk(book.bookId, index - 1, book.totalChunks),
          ensureChunk(book.bookId, index, book.totalChunks),
          ensureChunk(book.bookId, index + 1, book.totalChunks),
        ]);

        if (!current) {
          throw new Error("Could not load this page");
        }

        await setCheckpoint(book.bookId, index);
        void prefetchWindow(book.bookId, index, book.totalChunks);

        setState({
          prev,
          current,
          next,
          index,
          loading: false,
          error: null,
        });
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load",
        }));
      }
    },
    [book.bookId, book.totalChunks]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cache = await loadReaderCache();
      const startIndex =
        cache?.activeBookId === book.bookId
          ? Math.min(cache.checkpointIndex, book.totalChunks - 1)
          : 0;

      if (!cache || cache.activeBookId !== book.bookId) {
        await initBookCache(book.bookId, startIndex);
      }

      if (!cancelled) {
        await loadWindow(Math.max(0, startIndex));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [book.bookId, book.totalChunks, loadWindow]);

  const goNext = useCallback(() => {
    if (state.index >= book.totalChunks - 1) return;
    void loadWindow(state.index + 1);
  }, [book.totalChunks, loadWindow, state.index]);

  const goPrev = useCallback(() => {
    if (state.index <= 0) return;
    void loadWindow(state.index - 1);
  }, [loadWindow, state.index]);

  return {
    ...state,
    canGoPrev: state.index > 0,
    canGoNext: state.index < book.totalChunks - 1,
    goNext,
    goPrev,
    reload: () => loadWindow(state.index),
  };
}
