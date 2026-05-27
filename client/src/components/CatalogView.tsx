import { useEffect, useState } from "react";
import { fetchBooks, getApiBaseDisplay } from "../api";
import type { BookMetadata } from "../types";
import "./CatalogView.css";

interface CatalogViewProps {
  onSelectBook: (book: BookMetadata) => void;
}

export function CatalogView({ onSelectBook }: CatalogViewProps) {
  const [books, setBooks] = useState<BookMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await fetchBooks();
        if (!cancelled) {
          setBooks(list);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load library");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="catalog">
      <header className="catalog__header reading-column">
        <h1 className="catalog__title">iSpeedRead</h1>
        <p className="catalog__subtitle">Library</p>
        <p className="catalog__api">Server: {getApiBaseDisplay()}</p>
      </header>

      <main className="catalog__list reading-column">
        {loading && <p className="catalog__message">Loading books…</p>}
        {error && (
          <p className="catalog__message catalog__message--error">{error}</p>
        )}
        {!loading && !error && books.length === 0 && (
          <p className="catalog__message">
            No books yet. Upload an EPUB or PDF to the laptop server.
          </p>
        )}
        <ul className="catalog__items">
          {books.map((book) => (
            <li key={book.bookId}>
              <button
                type="button"
                className="catalog__item"
                onClick={() => onSelectBook(book)}
              >
                <span className="catalog__item-title">{book.title}</span>
                <span className="catalog__item-meta">
                  {book.author} · {book.totalChunks} pages
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
