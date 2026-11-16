"use client";
import { lazy, Suspense } from "react";
// Studying/answering cards does not need to download the document editor.
// The existing PWA precache includes this chunk for editing offline.
const RichEditor = lazy(() => import("./RichEditor"));
export default function CardTextEditor({
  value,
  onChange,
  placeholder,
  fieldName,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  fieldName: string;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="material-editor rich-editor-shell card-rich-editor"
          role="group"
          aria-label={`Editor de ${fieldName}`}
          aria-busy="true"
        >
          <p role="status">Preparando editor…</p>
        </div>
      }
    >
      <RichEditor
        html={value}
        onChange={onChange}
        variant="card"
        allowImages={false}
        label={placeholder || fieldName}
        placeholder={placeholder}
        fieldName={fieldName}
      />
    </Suspense>
  );
}
