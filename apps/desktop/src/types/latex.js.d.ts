declare module "latex.js" {
  export interface HtmlGeneratorOptions {
    hyphenate?: boolean;
  }

  export class HtmlGenerator {
    constructor(options?: HtmlGeneratorOptions);
    domFragment(): DocumentFragment;
    htmlDocument(): HTMLDocument;
  }

  export function parse(source: string, options?: { generator?: HtmlGenerator }): unknown;
}
