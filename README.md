# iSpeedRead

Client-server reading utility. Phase 1 provides the **laptop library server**: ingest EPUB/PDF files, parse into sentence-tokenized chunks, and serve them over LAN-friendly REST APIs for the iPad PWA (Phase 2+).

## Prerequisites

- **Node.js 20+**
- **Python 3.10+** (optional, for academic PDF extraction via PyMuPDF)

## Setup

```bash
npm install
cp .env.example .env
```

For academic PDFs:

```bash
pip install pymupdf
```

## Development

```bash
npm run dev
```

Server listens on `http://0.0.0.0:5000` by default.

## Production

```bash
npm run build
npm start
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/upload` | Upload EPUB or PDF (`multipart/form-data`, field `file`) |
| `GET` | `/api/books` | List book metadata |
| `GET` | `/api/books/:id` | Single book metadata |
| `GET` | `/api/books/:id/chunk/:index` | Fetch one chunk (0-based index) |

### Upload

**EPUB:**

```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@./my-book.epub"
```

**PDF (basic text layer):**

```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@./paper.pdf"
```

**PDF (academic — Python/PyMuPDF):**

```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@./paper.pdf" \
  -F "academic=true"
```

Response:

```json
{
  "bookId": "uuid",
  "title": "Book Title",
  "author": "Author Name",
  "totalChunks": 42
}
```

### List books

```bash
curl http://localhost:5000/api/books
```

### Fetch chunk

```bash
curl http://localhost:5000/api/books/{bookId}/chunk/0
```

Chunk response:

```json
{
  "index": 0,
  "text": "Full chunk text...",
  "sentences": ["Sentence one.", "Sentence two."]
}
```

## LAN access (iPad client)

1. Find your laptop's local IP (e.g. `ipconfig` on Windows, `192.168.x.x`).
2. Ensure the iPad is on the same Wi-Fi network.
3. Point the future PWA at `http://<laptop-ip>:5000`.

Example: `http://192.168.1.42:5000/api/books`

## Storage layout

```
library/uploads/   # Raw uploaded EPUB/PDF files
data/library.db    # SQLite (books + chunks)
```

## Tests

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
