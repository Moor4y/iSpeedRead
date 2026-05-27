declare module "pdf-parse" {
  interface PdfInfo {
    Title?: string;
    Author?: string;
  }

  interface PdfData {
    text: string;
    info?: PdfInfo;
  }

  function pdfParse(buffer: Buffer): Promise<PdfData>;
  export default pdfParse;
}
