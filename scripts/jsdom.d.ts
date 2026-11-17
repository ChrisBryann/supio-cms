// Minimal types for the part of jsdom (a devDependency without bundled types) the import scripts use.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string)
    window: { document: Document }
  }
}
