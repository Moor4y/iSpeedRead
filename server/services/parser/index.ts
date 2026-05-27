import type { ParseResult, SourceType } from "../../types/book.js";
import { parseEpub } from "./epub.js";
import { parsePdfAcademic, parsePdfBasic } from "./pdf.js";

export async function parseBookFile(
  filePath: string,
  originalFilename: string,
  sourceType: SourceType,
  academic: boolean
): Promise<ParseResult> {
  if (sourceType === "epub") {
    return parseEpub(filePath, originalFilename);
  }

  if (sourceType === "pdf") {
    if (academic) {
      return parsePdfAcademic(filePath, originalFilename);
    }
    return parsePdfBasic(filePath, originalFilename);
  }

  throw new Error(`Unsupported source type: ${sourceType}`);
}
