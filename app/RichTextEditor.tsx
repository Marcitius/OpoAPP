"use client";
import { sanitizeMaterial } from "../lib/material/sanitize";
// The text fields and reader share Material's formatting policy. Images remain
// managed by each card's existing private attachment, outside these text fields.
export function sanitizeRichHtml(html: string) {
  return sanitizeMaterial(html ?? "").replace(/<img\b[^>]*>/gi, "");
}
export function plainRichText(html: string) {
  return sanitizeRichHtml(html)
    .replace(/<br\s*\/?\s*>|<\/(?:p|li|div|h[1-6]|blockquote|tr|pre)>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " ")
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
      className={"rich-content rich-prose " + className}
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
    />
  );
}
