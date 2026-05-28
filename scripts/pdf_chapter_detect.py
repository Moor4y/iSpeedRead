"""
PDF parsing with chapter detection for iSpeedRead.

Ported from pdf-chapter-splitter (bookmarks/TOC first, then heading heuristics).

Stdout JSON:
{
  "title": "...",
  "author": "...",
  "detectionMethod": "bookmarks" | "headings" | "full_book",
  "warnings": [],
  "chapters": [{ "title": "Chapter 1", "text": "..." }]
}
"""
from __future__ import annotations

import json
import logging
import re
import sys
import argparse
from dataclasses import dataclass
from enum import Enum
from typing import Pattern

logger = logging.getLogger(__name__)

DEFAULT_HEADING_PATTERNS: list[str] = [
    r"^Chapter\s+\d+",
    r"^CHAPTER\s+\d+",
    r"^CHAPTER\s+[IVXLC]+",
    r"^Part\s+\d+",
    r"^PART\s+\d+",
    r"^Book\s+\d+",
    r"^Section\s+\d+",
]

ZH_HEADING_PATTERNS: list[str] = [
    r"^第[\d一二三四五六七八九十百千两零]+[章节回部卷篇]",
    r"^第[\d一二三四五六七八九十百千两零]+章",
    r"^序章",
    r"^前言",
    r"^引言",
]


class DetectionMethod(str, Enum):
    BOOKMARKS = "bookmarks"
    HEADINGS = "headings"
    FULL_BOOK = "full_book"


@dataclass(frozen=True)
class ChapterSpan:
    title: str
    start_page: int
    end_page: int
    index: int = 0


def detect_language(doc, page_limit: int = 10) -> str:
    sample_parts: list[str] = []
    limit = min(page_limit, doc.page_count)
    for page_index in range(limit):
        sample_parts.append(doc[page_index].get_text("text"))
    sample = "".join(sample_parts)
    if not sample:
        return "en"

    total_chars = len(sample)
    han_chars = len(re.findall(r"[\u3400-\u9fff]", sample))
    return "zh" if total_chars and (han_chars / total_chars) >= 0.1 else "en"


def compile_patterns(
    patterns: list[str] | None = None, lang: str = "en"
) -> list[Pattern[str]]:
    source = patterns if patterns is not None else DEFAULT_HEADING_PATTERNS
    if patterns is None and lang == "zh":
        source = source + ZH_HEADING_PATTERNS
    return [re.compile(p, re.IGNORECASE | re.MULTILINE) for p in source]


def line_matches_heading(line: str, patterns: list[Pattern[str]]) -> bool:
    stripped = line.strip()
    if not stripped or len(stripped) > 120:
        return False
    return any(p.search(stripped) for p in patterns)


def _dedupe_overlapping(chapters: list[ChapterSpan]) -> list[ChapterSpan]:
    if not chapters:
        return []
    result: list[ChapterSpan] = []
    for ch in chapters:
        if result and ch.start_page <= result[-1].start_page:
            continue
        result.append(ch)
    return result


def toc_to_chapters(doc, chapter_level: int = 1, min_chapters: int = 2) -> list[ChapterSpan]:
    toc = doc.get_toc(simple=True)
    if not toc:
        return []

    entries = [(level, title.strip(), page) for level, title, page in toc if title.strip()]
    if not entries:
        return []

    level_entries = [(title, page) for level, title, page in entries if level == chapter_level]
    if len(level_entries) < min_chapters:
        deeper = [(title, page) for level, title, page in entries if level == chapter_level + 1]
        if len(deeper) >= min_chapters:
            level_entries = deeper
        elif len(entries) >= min_chapters:
            min_level = min(level for level, _, _ in entries)
            level_entries = [
                (title, page) for level, title, page in entries if level == min_level
            ]

    if len(level_entries) < min_chapters:
        return []

    page_count = doc.page_count
    chapters: list[ChapterSpan] = []

    for idx, (title, start_page_1based) in enumerate(level_entries):
        start = max(0, start_page_1based - 1)
        if idx + 1 < len(level_entries):
            next_start_1based = level_entries[idx + 1][1]
            end = max(start, next_start_1based - 2)
        else:
            end = page_count - 1
        if start > end:
            continue
        chapters.append(
            ChapterSpan(title=title, start_page=start, end_page=end, index=len(chapters) + 1)
        )

    return _dedupe_overlapping(chapters)


def find_heading_pages(
    doc,
    patterns: list[Pattern[str]] | None = None,
    min_chapters: int = 2,
    lang: str = "en",
):
    compiled = patterns if patterns is not None else compile_patterns(lang=lang)
    hits: list[tuple[str, int]] = []

    for page_index in range(doc.page_count):
        text = doc[page_index].get_text()
        for line in text.splitlines():
            if line_matches_heading(line, compiled):
                hits.append((line.strip(), page_index))
                break

    if len(hits) < min_chapters:
        return []

    deduped: list[tuple[str, int]] = []
    for title, page in hits:
        if deduped and deduped[-1][1] == page:
            continue
        deduped.append((title, page))

    return deduped


def headings_to_chapters(
    doc,
    patterns: list[Pattern[str]] | None = None,
    min_chapters: int = 2,
    lang: str = "en",
) -> list[ChapterSpan]:
    hits = find_heading_pages(doc, patterns=patterns, min_chapters=min_chapters, lang=lang)
    if len(hits) < min_chapters:
        return []

    page_count = doc.page_count
    chapters: list[ChapterSpan] = []

    for idx, (title, start_page) in enumerate(hits):
        if idx + 1 < len(hits):
            end_page = hits[idx + 1][1] - 1
        else:
            end_page = page_count - 1
        end_page = max(start_page, end_page)
        chapters.append(
            ChapterSpan(title=title, start_page=start_page, end_page=end_page, index=len(chapters) + 1)
        )

    return chapters


def detect_chapters(doc, chapter_level: int = 1, min_chapters: int = 2, lang: str = "en"):
    warnings: list[str] = []
    chapters = toc_to_chapters(doc, chapter_level=chapter_level, min_chapters=min_chapters)
    if len(chapters) >= min_chapters:
        return chapters, DetectionMethod.BOOKMARKS, warnings

    chapters = headings_to_chapters(doc, min_chapters=min_chapters, lang=lang)
    if len(chapters) >= min_chapters:
        warnings.append("No usable bookmarks; used heading detection.")
        return chapters, DetectionMethod.HEADINGS, warnings

    warnings.append("No chapters detected; treating document as a single section.")
    return [
        ChapterSpan(
            title="Full book",
            start_page=0,
            end_page=doc.page_count - 1,
            index=1,
        )
    ], DetectionMethod.FULL_BOOK, warnings


def extract_chapter_text(doc, chapter: ChapterSpan) -> str:
    parts: list[str] = []
    for page_index in range(chapter.start_page, chapter.end_page + 1):
        text = doc[page_index].get_text("text")
        if text and text.strip():
            parts.append(text.strip())
    return "\n\n".join(parts)


def parse_pdf(pdf_path: str, lang: str = "en") -> dict:
    import fitz

    doc = fitz.open(pdf_path)
    try:
        meta = doc.metadata or {}
        detected_lang = detect_language(doc) if lang == "auto" else lang
        chapters, method, warnings = detect_chapters(doc, lang=detected_lang)

        chapter_payloads = []
        for chapter in chapters:
            text = extract_chapter_text(doc, chapter)
            if not text.strip():
                continue
            chapter_payloads.append({"title": chapter.title, "text": text})

        if not chapter_payloads:
            full_text = extract_chapter_text(
                doc,
                ChapterSpan("Full book", 0, doc.page_count - 1, 1),
            )
            chapter_payloads = [{"title": "Full book", "text": full_text}]

        return {
            "title": (meta.get("title") or "").strip(),
            "author": (meta.get("author") or "").strip(),
            "detectedLang": detected_lang,
            "detectionMethod": method.value,
            "warnings": warnings,
            "chapters": chapter_payloads,
        }
    finally:
        doc.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect chapters from PDF")
    parser.add_argument("pdf_path")
    parser.add_argument("--lang", choices=["en", "zh", "auto"], default="auto")
    args = parser.parse_args()

    try:
        result = parse_pdf(args.pdf_path, args.lang)
    except ImportError:
        print("PyMuPDF not installed. Run: pip install pymupdf", file=sys.stderr)
        return 1
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
