import { sanitizeMaterial } from "./sanitize";
export { sanitizeMaterial } from "./sanitize";
import { Marked } from "marked";
const parser = new Marked({ gfm: true, breaks: true });
parser.use({
  extensions: [
    {
      name: "letterList",
      level: "block",
      start: (s: string) => s.match(/^[a-z]\) /m)?.index,
      tokenizer(src: string) {
        const match = src.match(/^(?:[a-z]\)[ \t]+[^\n]+(?:\n[ \t]*\n|\n|$))+/);
        if (!match) return;
        const rows = match[0]
          .trimEnd()
          .split(/\n+/)
          .map((line) => ({ letter: line[0], text: line.slice(2).trim() }));
        if (rows.length < 2) return;
        // Only genuine consecutive alphabetic lists; do not reinterpret arbitrary prose.
        if (
          !rows.every(
            (r, i) =>
              !i ||
              r.letter.charCodeAt(0) === rows[i - 1].letter.charCodeAt(0) + 1,
          )
        )
          return;
        return { type: "letterList", raw: match[0], rows };
      },
      renderer(token: any) {
        return `<ol type="a" start="${token.rows[0].letter.charCodeAt(0) - 96}">${token.rows.map((r: any) => `<li><p>${parser.parseInline(r.text)}</p></li>`).join("")}</ol>`;
      },
    },
  ],
});
export function markdownToMaterial(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/^(\s*)\\([-+*])\s/gm, "$1$2 ");
  return sanitizeMaterial(parser.parse(normalized, { async: false }) as string);
}
export function clipboardMaterial(html: string, text: string): string {
  // Browser clipboard HTML preserves richer formatting than plain text.
  // ChatGPT/code-copy may wrap Markdown in a single PRE instead of rich HTML.
  if (
    html &&
    !/^\s*(?:<meta[^>]*>\s*)?<pre[\s>]/i.test(html) &&
    /<(?:p|h[1-6]|ul|ol|table|strong|b|em|span|div)\b/i.test(html)
  )
    return sanitizeMaterial(html);
  return markdownToMaterial(text);
}
