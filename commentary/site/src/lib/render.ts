import { marked } from "marked";

// Block-level Markdown -> HTML. Content is trusted (our own repo sources),
// so no sanitization is needed. Synchronous (no async extensions).
export function renderMarkdown(md: string): string {
  return (marked.parse(md, { async: false }) as string).trim();
}
