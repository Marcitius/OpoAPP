"use client";

import { type MouseEvent as ReactMouseEvent, useEffect, useRef } from "react";

const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "P", "DIV", "BR", "UL", "OL", "LI", "SPAN"]);

export function sanitizeRichHtml(input: string) {
  if (typeof window === "undefined" || !input.includes("<")) return input.trim();
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${input}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";

  const clean = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return null;
    const tag = allowedTags.has(node.tagName) ? node.tagName.toLowerCase() : "span";
    const element = doc.createElement(tag);
    const color = node.style.color;
    if (color) element.style.color = color;
    for (const child of Array.from(node.childNodes)) {
      const cleaned = clean(child);
      if (cleaned) element.appendChild(cleaned);
    }
    return element;
  };

  const wrapper = doc.createElement("div");
  for (const child of Array.from(root.childNodes)) {
    const cleaned = clean(child);
    if (cleaned) wrapper.appendChild(cleaned);
  }
  return wrapper.innerHTML.trim();
}

function run(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export default function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const command = (name: string, val?: string) => (event: ReactMouseEvent) => {
    event.preventDefault();
    ref.current?.focus();
    run(name, val);
    onChange(ref.current?.innerHTML ?? "");
  };

  return (
    <div className="rich-editor-shell">
      <div className="rich-toolbar" role="toolbar" aria-label="Formato de texto">
        <button type="button" onMouseDown={command("bold")}><strong>B</strong></button>
        <button type="button" onMouseDown={command("italic")}><em>I</em></button>
        <button type="button" onMouseDown={command("underline")}><u>U</u></button>
        <button type="button" onMouseDown={command("insertUnorderedList")}>• Lista</button>
        <button type="button" onMouseDown={command("insertOrderedList")}>1. Lista</button>
        <button type="button" className="rich-color-dot ink" title="Texto negro" onMouseDown={command("foreColor", "#1f2923")}>A</button>
        <button type="button" className="rich-color-dot green" title="Texto verde" onMouseDown={command("foreColor", "#285943")}>A</button>
        <button type="button" className="rich-color-dot blue" title="Texto azul" onMouseDown={command("foreColor", "#2C6E8F")}>A</button>
        <button type="button" className="rich-color-dot red" title="Texto rojo" onMouseDown={command("foreColor", "#A94F3E")}>A</button>
        <button type="button" onMouseDown={command("removeFormat")}>Limpiar</button>
      </div>
      <div
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
      />
    </div>
  );
}

export function RichContent({ html, className = "" }: { html: string; className?: string }) {
  if (!html) return null;
  if (!html.includes("<")) return <div className={`rich-content ${className}`}>{html}</div>;
  return <div className={`rich-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function plainRichText(html: string) {
  if (!html) return "";
  if (typeof window !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent ?? "";
  }
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
