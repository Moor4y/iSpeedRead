import { useTripleBuffer } from "../hooks/useTripleBuffer";
import type { BookMetadata } from "../types";
import { TripleBufferViewport } from "./TripleBufferViewport";
import "./ReadingView.css";

interface ReadingViewProps {
  book: BookMetadata;
  onBack: () => void;
}

export function ReadingView({ book, onBack }: ReadingViewProps) {
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

  return (
    <div className="reading-view">
      <header className="reading-view__header reading-column">
        <button type="button" className="reading-view__back" onClick={onBack}>
          ← Library
        </button>
        <div className="reading-view__meta">
          <span className="reading-view__title">{book.title}</span>
          <span className="reading-view__progress">
            {index + 1} / {book.totalChunks}
          </span>
        </div>
      </header>

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
      />
    </div>
  );
}
