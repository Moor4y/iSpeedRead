import { useCallback, useEffect, useRef, useState } from "react";
import type { Chunk } from "../types";
import { ChunkPanel } from "./ChunkPanel";
import "./TripleBufferViewport.css";

export type SlideDirection = "next" | "prev" | null;

interface TripleBufferViewportProps {
  prev: Chunk | null;
  current: Chunk | null;
  next: Chunk | null;
  loading: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  activeSentenceIndex?: number | null;
  /** When true, space bar is reserved for TTS (handled in ReadingView). */
  ttsCaptureSpace?: boolean;
}

/** Percent of track height (3 panels); -33.333% centers the current panel. */
type TrackOffset = 0 | -33.333 | -66.666;

export function TripleBufferViewport({
  prev,
  current,
  next,
  loading,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  activeSentenceIndex = null,
  ttsCaptureSpace = false,
}: TripleBufferViewportProps) {
  const [offset, setOffset] = useState<TrackOffset>(-33.333);
  const [animating, setAnimating] = useState(false);
  const [manualSentenceIndex, setManualSentenceIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const currentPanelRef = useRef<HTMLElement | null>(null);
  const slideTimerRef = useRef<number | null>(null);
  const pendingSentenceEdgeRef = useRef<"first" | "last" | null>(null);

  const clearSlideTimer = () => {
    if (slideTimerRef.current !== null) {
      window.clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }
  };

  const getCurrentSentences = useCallback((): HTMLParagraphElement[] => {
    const panel = currentPanelRef.current;
    if (!panel) return [];
    return Array.from(panel.querySelectorAll<HTMLParagraphElement>(".sentence"));
  }, []);

  const scrollSentenceIntoView = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth"): boolean => {
      const sentences = getCurrentSentences();
      if (!sentences.length) return false;
      const clamped = Math.max(0, Math.min(index, sentences.length - 1));
      const target = sentences[clamped];
      if (!target) return false;
      target.scrollIntoView({ block: "center", behavior });
      setManualSentenceIndex(clamped);
      return true;
    },
    [getCurrentSentences]
  );

  const runSlide = useCallback(
    (direction: "next" | "prev", action: () => void) => {
      if (animating) return;
      if (direction === "next" && !canGoNext) return;
      if (direction === "prev" && !canGoPrev) return;

      setAnimating(true);
      setOffset(direction === "next" ? -66.666 : 0);

      const track = trackRef.current;
      if (!track) {
        action();
        setOffset(-33.333);
        setAnimating(false);
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearSlideTimer();
        track.removeEventListener("transitionend", onEnd);
        action();
        setOffset(-33.333);
        setAnimating(false);
      };
      const onEnd = (ev: TransitionEvent) => {
        if (ev.propertyName !== "transform") return;
        finish();
      };

      track.addEventListener("transitionend", onEnd);

      // Fallback: some browsers/timing paths can miss transitionend.
      // Keep navigation responsive by completing the slide anyway.
      slideTimerRef.current = window.setTimeout(finish, 260);
    },
    [animating, canGoNext, canGoPrev, clearSlideTimer]
  );

  const ttsActive = activeSentenceIndex !== null && activeSentenceIndex !== undefined;

  const navigateByLine = useCallback(
    (direction: "next" | "prev") => {
      // While TTS is actively tracking sentences, keep controls chunk-based
      // so users can reliably move the currently playing audio chunk.
      if (ttsActive) {
        if (direction === "next") runSlide("next", onNext);
        else runSlide("prev", onPrev);
        return;
      }

      const sentences = getCurrentSentences();
      if (!sentences.length) {
        if (direction === "next") runSlide("next", onNext);
        else runSlide("prev", onPrev);
        return;
      }

      const base = Math.max(0, Math.min(manualSentenceIndex, sentences.length - 1));
      const nextIndex = direction === "next" ? base + 1 : base - 1;

      if (nextIndex >= 0 && nextIndex < sentences.length) {
        scrollSentenceIntoView(nextIndex);
        return;
      }

      if (direction === "next" && canGoNext) {
        pendingSentenceEdgeRef.current = "first";
        runSlide("next", onNext);
        return;
      }

      if (direction === "prev" && canGoPrev) {
        pendingSentenceEdgeRef.current = "last";
        runSlide("prev", onPrev);
      }
    },
    [
      canGoNext,
      canGoPrev,
      getCurrentSentences,
      manualSentenceIndex,
      onNext,
      onPrev,
      runSlide,
      scrollSentenceIntoView,
      ttsActive,
    ]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        navigateByLine("next");
      } else if (e.key === " " && !ttsCaptureSpace) {
        e.preventDefault();
        navigateByLine("next");
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        navigateByLine("prev");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigateByLine, ttsCaptureSpace]);

  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX =
      touchStartX.current === null
        ? 0
        : e.changedTouches[0].clientX - touchStartX.current;
    touchStartY.current = null;
    touchStartX.current = null;

    if (Math.abs(deltaY) >= 48 && Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY < 0) navigateByLine("next");
      else navigateByLine("prev");
    }
  };

  useEffect(() => {
    return () => {
      clearSlideTimer();
    };
  }, [clearSlideTimer]);

  useEffect(() => {
    if (activeSentenceIndex === null || activeSentenceIndex === undefined) return;
    setManualSentenceIndex(activeSentenceIndex);
  }, [activeSentenceIndex]);

  useEffect(() => {
    const edge = pendingSentenceEdgeRef.current;
    if (!edge) return;
    pendingSentenceEdgeRef.current = null;

    window.requestAnimationFrame(() => {
      const sentences = getCurrentSentences();
      if (!sentences.length) return;
      const idx = edge === "first" ? 0 : sentences.length - 1;
      scrollSentenceIntoView(idx, "auto");
    });
  }, [current?.index, getCurrentSentences, scrollSentenceIntoView]);

  const sentenceCount = current?.sentences.length ?? 0;
  const clampedManualIndex =
    sentenceCount > 0
      ? Math.max(0, Math.min(manualSentenceIndex, sentenceCount - 1))
      : 0;
  const canStepPrev = ttsActive
    ? canGoPrev
    : sentenceCount > 0 && (clampedManualIndex > 0 || canGoPrev);
  const canStepNext = ttsActive
    ? canGoNext
    : sentenceCount > 0 && (clampedManualIndex < sentenceCount - 1 || canGoNext);

  return (
    <div
      className="triple-buffer"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        ref={trackRef}
        className={`triple-buffer__track${animating ? " triple-buffer__track--animating" : ""}`}
        style={{ transform: `translate3d(0, ${offset}%, 0)` }}
      >
        <section className="triple-buffer__panel" aria-hidden={offset !== 0}>
          <ChunkPanel chunk={prev} />
        </section>
        <section
          className="triple-buffer__panel"
          aria-hidden={offset !== -33.333}
          ref={(el) => {
            currentPanelRef.current = el;
          }}
        >
          <ChunkPanel
            chunk={current}
            loading={loading && !current}
            activeSentenceIndex={activeSentenceIndex}
          />
        </section>
        <section
          className="triple-buffer__panel"
          aria-hidden={offset !== -66.666}
        >
          <ChunkPanel chunk={next} />
        </section>
      </div>

      <div className="triple-buffer__chrome reading-column">
        <button
          type="button"
          className="triple-buffer__nav"
          disabled={!canStepPrev || animating}
          onClick={() => navigateByLine("prev")}
          aria-label="Previous line"
        >
          ↑
        </button>
        <button
          type="button"
          className="triple-buffer__nav"
          disabled={!canStepNext || animating}
          onClick={() => navigateByLine("next")}
          aria-label="Next line"
        >
          ↓
        </button>
      </div>
    </div>
  );
}
