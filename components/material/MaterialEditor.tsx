"use client";
import RichEditor, { type RichEditorProps } from "../editor/RichEditor";
export default function MaterialEditor(
  props: Omit<
    RichEditorProps,
    "variant" | "label" | "fieldName" | "allowImages"
  >,
) {
  return <RichEditor {...props} variant="material" allowImages />;
}
