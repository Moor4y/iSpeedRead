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
}: TripleBufferViewportProps) {
  const [offset, setOffset] = useState<TrackOffset>(-33.333);
  const [animating, setAnimating] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

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

      const onEnd = (ev: TransitionEvent) => {
        if (ev.propertyName !== "transform") return;
        track.removeEventListener("transitionend", onEnd);
        action();
        setOffset(-33.333);
        setAnimating(false);
      };

      track.addEventListener("transitionend", onEnd);
    },
    [animating, canGoNext, canGoPrev]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        runSlide("next", onNext);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        runSlide("prev", onPrev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onPrev, runSlide]);

  const touchStartY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) runSlide("next", onNext);
    else runSlide("prev", onPrev);
  };

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
        >
          <ChunkPanel chunk={current} loading={loading && !current} />
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
          disabled={!canGoPrev || animating}
          onClick={() => runSlide("prev", onPrev)}
          aria-label="Previous page"
        >
          ↑
        </button>
        <button
          type="button"
          className="triple-buffer__nav"
          disabled={!canGoNext || animating}
          onClick={() => runSlide("next", onNext)}
          aria-label="Next page"
        >
          ↓
        </button>
      </div>
    </div>
  );
}
