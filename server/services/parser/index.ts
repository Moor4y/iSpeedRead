import type { ParseResult, SourceType } from "../../types/book.js";
import type { AdminLang } from "../../types/admin.js";
import { parseEpub } from "./epub.js";
import { parsePdfAcademic, parsePdfBasic } from "./pdf.js";

export type ParseLangHint = AdminLang | "auto";

export async function parseBookFile(
  filePath: string,
  originalFilename: string,
  sourceType: SourceType,
  academic: boolean,
  lang: ParseLangHint = "auto"
): Promise<ParseResult> {
  if (sourceType === "epub") {
    return parseEpub(filePath, originalFilename);
  }

  if (sourceType === "pdf") {
    if (academic) {
      return parsePdfAcademic(filePath, originalFilename, lang);
    }
    return parsePdfBasic(filePath, originalFilename, lang);
  }

  throw new Error(`Unsupported source type: ${sourceType}`);
}
