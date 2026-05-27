# iSpeedRead

Client-server reading utility: a **laptop library server** ingests EPUB/PDF files, and an **iPad PWA thin client** reads them over local Wi-Fi with OLED-optimized UI, triple-buffer paging, and offline chunk cache.

## Prerequisites

- **Node.js 20+**
- **Python 3.10+** (optional — for academic PDF extraction and TTS synthesis)

## Setup

```bash
npm install
cp .env.example .env
```

Install client dependencies:

```bash
cd client
npm install
cd ..
```

For PDF chapter detection and TTS synthesis:

```bash
pip install -r scripts/requirements.txt
# pydub also requires ffmpeg on PATH
# Windows: winget install ffmpeg
# macOS:   brew install ffmpeg
```

---

## Development

**Terminal 1 — library server (port 5000):**

```bash
npm run dev
```

**Terminal 2 — PWA client (port 5173):**

```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies all `/api` requests to port 5000 automatically — no extra config needed.

---

## Using the UI

### 1. Upload books

The server accepts EPUB and PDF files up to 100 MB each. You can upload one file or drop a whole batch at once.

**Single file:**

```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@./my-book.epub"
```

**Batch upload (multiple files in one request):**

```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@./book1.epub" \
  -F "file=@./book2.pdf" \
  -F "file=@./paper.pdf"
```

**Academic PDF** (uses PyMuPDF for better chapter detection):

```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@./paper.pdf" \
  -F "academic=true"
```

Single-file response:

```json
{
  "bookId": "3f2a1b...",
  "title": "Book Title",
  "author": "Author Name",
  "totalChunks": 42
}
```

Batch response:

```json
{
  "results": [
    { "bookId": "...", "title": "Book 1", "author": "...", "totalChunks": 38 },
    { "bookId": "...", "title": "Book 2", "author": "...", "totalChunks": 91 }
  ],
  "errors": []
}
```

After upload, the original source file is deleted. Processed content lives in `library/books/<bookId>/source.md` and `library/books/<bookId>/chunks.json`.

---

### 2. Browse the catalog

Open `http://localhost:5173`. The **Library** screen lists every ingested book with its author and page count. Tap or click any title to open it.

If the list is empty, the page shows: *"No books yet. Upload an EPUB or PDF to the laptop server."*

---

### 3. Reading view

The reader uses a **triple-buffer viewport** — the previous, current, and next chunks are all rendered simultaneously. Swiping or clicking the edge arrows slides between them with a 150 ms translate animation.

- **← / →** arrows or swipe to page through chunks
- Current chapter title is shown in the header
- Progress indicator shows current chunk position out of total

---

### 4. TTS (text-to-speech)

The TTS controls live in the reading header.

| Control | What it does |
|---------|-------------|
| **TTS** button | Toggles TTS mode on/off |
| **▶ / ❚❚** button | Play or pause audio for the current chunk |
| **EN / 中文** | Switch between English and Chinese voices |
| **Speed slider** | Playback rate: 0.75×, 1×, 1.25×, 1.5×, 2×, 2.5×, 3× |
| **Space bar** | Play/pause shortcut (when TTS is enabled) |

While audio plays, the **active sentence is highlighted** in white; the rest fade to 25% opacity. When a chunk finishes, the reader auto-advances to the next page.

TTS audio is synthesized on first play (may take up to a minute for long chunks) then cached to disk under `library/tts/` and in the browser's IndexedDB — subsequent plays are instant.

---

### 5. Offline cache

The PWA caches the app shell and pre-fetches chunks ahead of your reading position using localForage. Your reading checkpoint (last chunk index) is saved locally, so closing and reopening the app returns you to where you left off.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/upload` | Upload one or more EPUB/PDF files (`multipart/form-data`, field `file`) |
| `GET` | `/api/books` | List all books with filesystem metadata |
| `GET` | `/api/books/:id` | Single book metadata |
| `DELETE` | `/api/books/:id` | Delete a book (DB row + directory) |
| `GET` | `/api/books/:id/chunk/:index` | Fetch one chunk (0-based) |
| `GET` | `/api/books/:id/chunk/:index/tts?lang=en\|zh` | Neural TTS audio + sentence timeline |

### GET /api/books response

```json
[
  {
    "bookId": "3f2a1b...",
    "title": "Book Title",
    "author": "Author Name",
    "totalChunks": 42,
    "hasFileTree": true,
    "sourceFile": "/absolute/path/library/books/3f2a1b.../source.md",
    "chunksFile": "/absolute/path/library/books/3f2a1b.../chunks.json"
  }
]
```

`hasFileTree` is `false` for books uploaded before the file-tree overhaul — re-upload them to generate the directory.

### DELETE /api/books/:id

```bash
curl -X DELETE http://localhost:5000/api/books/3f2a1b...
```

```json
{ "deleted": true, "bookId": "3f2a1b..." }
```

Removes the SQLite row (cascades to chunks) and recursively deletes `library/books/<bookId>/`.

### Chunk response

```json
{
  "index": 0,
  "text": "Full chunk text...",
  "sentences": ["Sentence one.", "Sentence two."],
  "chapterTitle": "Chapter 2: The Nature of Complexity"
}
```

---

## LAN access (iPad PWA)

1. Find your laptop's local IP — `ipconfig` on Windows, `ifconfig` on macOS → look for `192.168.x.x`.
2. Connect iPad to the same Wi-Fi network.
3. Start both server and client in dev mode (see above).
4. On iPad Safari, open `http://<laptop-ip>:5173`.
5. Tap **Share → Add to Home Screen** for standalone PWA mode (hides browser chrome, enables landscape rotation).

**Production build** (recommended for iPad — faster, no hot-reload overhead):

```bash
cd client
cp .env.example .env
# Edit .env: set VITE_API_BASE=http://192.168.1.42:5000  (your laptop IP)
cd ..
npm run build
npm start
```

Open `http://<laptop-ip>:5000` on the iPad. The server now serves the PWA directly — no separate client process.

---

## Storage layout

```
library/
  uploads/          # Temp dir — source files are deleted after processing
  books/
    <uuid>/
      source.md     # Human-readable Markdown of the full book text
      chunks.json   # Parsed chunks with sentences and chapter titles
  tts/
    <uuid>/
      <index>_<lang>.json   # Cached TTS audio + timeline per chunk
data/
  library.db        # SQLite — book metadata + chunk text index
```

---

## Tests

```bash
npm test
```

---

## Production server

Build both server and client in one step:

```bash
npm run build
npm start
```

The Express server serves the compiled PWA from `client/dist/` on the same port as the API (default 5000). Open `http://localhost:5000` on your laptop or `http://<laptop-ip>:5000` on iPad — no separate client process needed.

For iPad, set the API base before building so the client points at the right host:

```bash
cd client
cp .env.example .env
# Edit client/.env: VITE_API_BASE=http://192.168.1.42:5000
cd ..
npm run build
npm start
```

---

## Appearance customization

Reading colors, font size, and column width are CSS variables in [`client/src/styles/tokens.css`](client/src/styles/tokens.css):

```css
--font-size-base      /* body text size, default 24px */
--column-padding-x    /* horizontal margin */
--color-text          /* body text color */
--color-bg            /* background, default #000000 */
```

A future settings panel can override these at runtime via `localStorage`.

---

## License

MIT — see [LICENSE](LICENSE).
