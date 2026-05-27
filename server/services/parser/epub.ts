import EPub from "epub2";
import type { ParseResult } from "../../types/book.js";
import {
  chunkText,
  extractHeadingCandidate,
  mergeAndReindexChunkSections,
} from "../chunker.js";
import { filenameStem } from "../storage.js";

interface EpubTocEntry {
  title?: string;
  id?: string;
}

interface EpubWithToc extends EPub {
  toc?: EpubTocEntry[];
}

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

function resolveChapterTitle(
  epub: EpubWithToc,
  flowId: string,
  sectionIndex: number,
  sectionText: string
): string {
  const tocMatch = epub.toc?.find((entry) => entry.id === flowId);
  if (tocMatch?.title?.trim()) {
    return tocMatch.title.trim();
  }

  const heading = extractHeadingCandidate(sectionText);
  if (heading) return heading;

  return `Section ${sectionIndex + 1}`;
}

export async function parseEpub(
  filePath: string,
  originalFilename: string
): Promise<ParseResult> {
  const epub = (await loadEpub(filePath)) as EpubWithToc;

  const title =
    epub.metadata?.title?.trim() || filenameStem(originalFilename);
  const author =
    epub.metadata?.creator?.trim() ||
    epub.metadata?.author?.trim() ||
    "Unknown Author";

  const flow = epub.flow ?? [];
  const sectionChunks: ReturnType<typeof chunkText>[] = [];
  let sectionIndex = 0;

  for (const item of flow) {
    if (!item?.id) continue;
    try {
      const chapterText = await getChapterText(epub, item.id);
      if (!chapterText) continue;

      const chapterTitle = resolveChapterTitle(
        epub,
        item.id,
        sectionIndex,
        chapterText
      );
      sectionChunks.push(chunkText(chapterText, undefined, chapterTitle, false));
      sectionIndex++;
    } catch {
      // skip unreadable sections
    }
  }

  const chunks = mergeAndReindexChunkSections(sectionChunks);

  if (chunks.length === 0) {
    throw new Error("EPUB contains no extractable text");
  }

  return {
    title,
    author,
    chunks,
  };
}
