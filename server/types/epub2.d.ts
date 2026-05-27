declare module "epub2" {
  interface EpubFlowItem {
    id: string;
    href?: string;
  }

  interface EpubMetadata {
    title?: string;
    creator?: string;
    author?: string;
  }

  interface EpubTocEntry {
    title?: string;
    id?: string;
  }

  export default class EPub {
    metadata: EpubMetadata;
    flow: EpubFlowItem[];
    toc?: EpubTocEntry[];
    constructor(filePath: string);
    parse(): void;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    getChapter(
      chapterId: string,
      callback: (err: Error | null, text?: string) => void
    ): void;
  }
}
