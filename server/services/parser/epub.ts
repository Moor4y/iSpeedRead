import EPub from "epub2";
import type { ParseResult } from "../../types/book.js";
import { chunkText } from "../chunker.js";
import { filenameStem } from "../storage.js";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function loadEpub(filePath: string): Promise<EPub> {
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath);
    epub.on("error", reject);
    epub.on("end", () => resolve(epub));
    epub.parse();
  });
}

function getChapterText(
  epub: EPub,
  chapterId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    epub.getChapter(chapterId, (err, text) => {
      if (err) reject(err);
      else resolve(stripHtml(text ?? ""));
    });
  });
}

export async function parseEpub(
  filePath: string,
  originalFilename: string
): Promise<ParseResult> {
  const epub = await loadEpub(filePath);

  const title =
    epub.metadata?.title?.trim() || filenameStem(originalFilename);
  const author =
    epub.metadata?.creator?.trim() ||
    epub.metadata?.author?.trim() ||
    "Unknown Author";

  const flow = epub.flow ?? [];
  const parts: string[] = [];

  for (const item of flow) {
    if (!item?.id) continue;
    try {
      const chapterText = await getChapterText(epub, item.id);
      if (chapterText) parts.push(chapterText);
    } catch {
      // skip unreadable sections
    }
  }

  const fullText = parts.join("\n\n");
  if (!fullText.trim()) {
    throw new Error("EPUB contains no extractable text");
  }

  return {
    title,
    author,
    chunks: chunkText(fullText),
  };
}
