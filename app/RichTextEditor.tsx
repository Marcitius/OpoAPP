"use client";
import DOMPurify from "isomorphic-dompurify";
import { useEffect, useRef } from "react";
export function sanitizeRichHtml(html: string) {
  return DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "span",
      "div",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "blockquote",
      "a",
      "sub",
      "sup",
      "mark",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
    ],
    ALLOWED_ATTR: ["href", "title", "style", "class"],
    FORBID_ATTR: ["onerror", "onclick"],
  }).replace(/style="([^"]*)"/g, (_match, styles: string) => {
    const safe = styles
      .split(";")
      .filter(
        (x) =>
          /^\s*(color|background-color|text-align|font-weight|font-style|text-decoration)\s*:\s*[^<>]*$/i.test(
            x,
          ) && !/(url\(|expression|javascript)/i.test(x),
      )
      .join(";");
    return safe ? `style="${safe}"` : "";
  });
}
export function plainRichText(html: string) {
  return sanitizeRichHtml(html)
    .replace(/<br\s*\/?\s*>|<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}
export function RichContent({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={"rich-content " + className}
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
    />
  );
}
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current)
      ref.current.innerHTML = sanitizeRichHtml(value);
  }, [value]);
  const command = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(sanitizeRichHtml(ref.current?.innerHTML ?? ""));
  };
  return (
    <div className="rich-editor-shell">
      <div
        className="rich-toolbar"
        role="toolbar"
        aria-label="Formato de texto"
      >
        {[
          ["bold", "Negrita", "B"],
          ["italic", "Cursiva", "I"],
          ["underline", "Subrayado", "U"],
          ["insertUnorderedList", "Lista", "•"],
          ["insertOrderedList", "Lista numerada", "1."],
          ["removeFormat", "Quitar formato", "Tx"],
        ].map(([cmd, title, label]) => (
          <button
            key={cmd}
            type="button"
            title={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(cmd)}
          >
            {label}
          </button>
        ))}
        <label className="rich-color">
          Color
          <input
            type="color"
            defaultValue="#285943"
            onChange={(e) => command("foreColor", e.target.value)}
          />
        </label>
      </div>
      <div
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? "Texto"}
        data-placeholder={placeholder}
        onInput={() => onChange(sanitizeRichHtml(ref.current?.innerHTML ?? ""))}
        onPaste={(e) => {
          e.preventDefault();
          command(
            "insertHTML",
            sanitizeRichHtml(
              e.clipboardData.getData("text/html") ||
                e.clipboardData.getData("text/plain").replaceAll("\n", "<br>"),
            ),
          );
        }}
      />
    </div>
  );
}
