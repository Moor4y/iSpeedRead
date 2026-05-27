# iSpeedRead

Client-server reading utility: a **laptop library server** ingests EPUB/PDF files, and an **iPad PWA thin client** reads them over local Wi-Fi with OLED-optimized UI, triple-buffer paging, and offline chunk cache.

## Prerequisites

- **Node.js 20+**
- **Python 3.10+** (optional, for academic PDF extraction via PyMuPDF)

## Setup

```bash
npm install
cp .env.example .env
```

For PDF ingest (chapter detection via bookmarks/headings, same approach as the `pdf-chapter-splitter` project):

```bash
pip install pymupdf
```

Re-upload PDFs after server updates so chapter titles are detected from the PDF outline.

## Development

**Terminal 1 — library server:**

```bash
npm run dev
```

Server listens on `http://0.0.0.0:5000`.

**Terminal 2 — iPad PWA client:**

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` on your laptop, or `http://<laptop-ip>:5173` on iPad (same Wi-Fi). The dev server proxies `/api` to port 5000.

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
| `GET` | `/api/books/:id/chunk/:index/tts?lang=en\|zh` | Neural TTS audio + sentence timeline |

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
  "sentences": ["Sentence one.", "Sentence two."],
  "chapterTitle": "Chapter 2: The Nature of Complexity"
}
```

## LAN access (iPad PWA)

1. Find your laptop's local IP (`ipconfig` on Windows → `192.168.x.x`).
2. Connect iPad to the same Wi-Fi.
3. Run both server and client (`npm run dev` and `cd client && npm run dev`).
4. On iPad Safari, open `http://<laptop-ip>:5173`.
5. **Add to Home Screen** for standalone PWA mode.

**Production build for iPad** (API on laptop port 5000):

```bash
cd client
cp .env.example .env
# Set VITE_API_BASE=http://192.168.1.42:5000  (your laptop IP)
npm run build
npm run preview -- --host
```

Then open `http://<laptop-ip>:4173` on the iPad.

### Phase 2 client features

- **Catalog** — lists books from `GET /api/books`
- **Reading view** — triple-buffer viewport (prev / current / next chunk) with 150ms `translate3d` slides
- **Offline cache** — localForage stores checkpoint + current window + 5 chunks ahead
- **OLED UI** — `#000000` canvas, `#8E8E93` body text, 650px column, Inter 24px / 1.65 line-height

### Phase 3 — TTS & focal anchor

**Server:** `GET /api/books/:id/chunk/:index/tts?lang=en|zh` synthesizes neural audio (Microsoft Edge TTS via Python) with per-sentence timeline markers. Results are cached under `library/tts/`.

**Client:**

- Toggle **TTS**, play/pause, **EN** / **中文** voices, speed up to **3.0×** (`audio.playbackRate`)
- **Focal anchor** — active sentence `#FFFFFF`, others `opacity: 0.25`, synced to audio
- **Double-buffer lookahead** — prefetches next chunk TTS while current page plays; auto-advances pages when audio ends

**TTS prerequisites (laptop):**

```bash
pip install -r scripts/requirements.txt
# pydub requires ffmpeg on PATH — install from https://ffmpeg.org or `winget install ffmpeg`
```

First play of a chunk may take a minute while audio is synthesized; later plays use disk/IndexedDB cache.

### Reading UI — header, chapters, landscape

- **Header** — book title, current **chapter** label, page progress, compact TTS controls
- **Chapter titles** — stored per chunk at ingest (`chapterTitle` on `GET /api/books/:id/chunk/:index`). PDFs use PyMuPDF: PDF bookmarks/TOC first, then heading patterns (ported from pdf-chapter-splitter).
- **Re-upload required** — books uploaded before chapter detection was added need a fresh upload to populate titles
- **Landscape** — PWA allows rotation (`orientation: any`); header uses a two-column layout; reading padding is reduced in landscape

### Future appearance settings

Reading colors, margins, and font size are controlled by CSS variables in [`client/src/styles/tokens.css`](client/src/styles/tokens.css) (`--font-size-base`, `--column-padding-x`, `--color-*`). A future settings panel can override these via `localStorage`.

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
