#!/usr/bin/env python3
"""
Academic PDF text extraction for iSpeedRead.
Outputs JSON to stdout: {"text": "...", "title": "...", "author": "..."}
Requires: pip install pymupdf
"""
import json
import sys


def extract_with_pymupdf(pdf_path: str) -> dict:
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    meta = doc.metadata or {}
    parts = []

    for page in doc:
        text = page.get_text("text")
        if text and text.strip():
            parts.append(text.strip())

    doc.close()

    return {
        "text": "\n\n".join(parts),
        "title": (meta.get("title") or "").strip(),
        "author": (meta.get("author") or "").strip(),
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: extract_academic.py <pdf_path>", file=sys.stderr)
        return 1

    pdf_path = sys.argv[1]

    try:
        result = extract_with_pymupdf(pdf_path)
    except ImportError:
        print(
            "PyMuPDF not installed. Run: pip install pymupdf",
            file=sys.stderr,
        )
        return 1
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
