declare module "sbd" {
  interface SbdOptions {
    newline_boundaries?: boolean;
    html_boundaries?: boolean;
    sanitize?: boolean;
  }

  function sentences(text: string, options?: SbdOptions): string[];
  export default { sentences };
}
