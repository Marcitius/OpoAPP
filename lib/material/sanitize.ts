import DOMPurify from "isomorphic-dompurify";
const allowedStyles =
  /^(?:color|background-color|font-family|font-size|line-height|text-align|font-weight|font-style|text-decoration|margin-left|width|min-width|height|border|border-color|border-width|border-style)$/i;
export function sanitizeMaterial(html: string): string {
  const clean = DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "del",
      "span",
      "div",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "a",
      "sub",
      "sup",
      "mark",
      "table",
      "colgroup",
      "col",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "hr",
      "pre",
      "code",
    ],
    ALLOWED_ATTR: [
      "href",
      "title",
      "style",
      "type",
      "start",
      "colspan",
      "rowspan",
      "colwidth",
      "width",
      "data-indent",
      "data-color",
    ],
    ALLOW_DATA_ATTR: false,
  });
  return clean.replace(/style="([^"]*)"/g, (_m, styles: string) => {
    const safe = styles
      .split(";")
      .filter((s) => {
        const colon = s.indexOf(":");
        return (
          colon > 0 &&
          allowedStyles.test(s.slice(0, colon).trim()) &&
          !/[<>\\]|url\s*\(|expression|javascript|@import/i.test(s)
        );
      })
      .join(";");
    return safe ? `style="${safe}"` : "";
  });
}
