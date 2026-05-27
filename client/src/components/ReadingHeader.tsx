import type { BookMetadata, Chunk } from "../types";
import { getDisplayChapterTitle } from "../utils/chapter";
import { TtsControls } from "./TtsControls";
import type { TtsControlsProps } from "./TtsControls";
import "./ReadingHeader.css";

interface ReadingHeaderProps {
  book: BookMetadata;
  currentChunk: Chunk | null;
  chunkIndex: number;
  onBack: () => void;
  tts: TtsControlsProps;
}

export function ReadingHeader({
  book,
  currentChunk,
  chunkIndex,
  onBack,
  tts,
}: ReadingHeaderProps) {
  const chapterLabel = getDisplayChapterTitle(currentChunk);

  return (
    <header className="reading-header reading-column">
      <div className="reading-header__top">
        <button type="button" className="reading-header__back" onClick={onBack}>
          ← Library
        </button>
        <span className="reading-header__progress">
          {chunkIndex + 1} / {book.totalChunks}
        </span>
      </div>

      <div className="reading-header__titles">
        <h1 className="reading-header__book">{book.title}</h1>
        <p className="reading-header__chapter">{chapterLabel}</p>
      </div>

      <TtsControls {...tts} />
    </header>
  );
}
