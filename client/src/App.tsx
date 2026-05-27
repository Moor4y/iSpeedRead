import { useState } from "react";
import { CatalogView } from "./components/CatalogView";
import { ReadingView } from "./components/ReadingView";
import type { AppView, BookMetadata } from "./types";

export default function App() {
  const [view, setView] = useState<AppView>("catalog");
  const [activeBook, setActiveBook] = useState<BookMetadata | null>(null);

  const openBook = (book: BookMetadata) => {
    setActiveBook(book);
    setView("reading");
  };

  const closeBook = () => {
    setView("catalog");
    setActiveBook(null);
  };

  if (view === "reading" && activeBook) {
    return <ReadingView book={activeBook} onBack={closeBook} />;
  }

  return <CatalogView onSelectBook={openBook} />;
}
