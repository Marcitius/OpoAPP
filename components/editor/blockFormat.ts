import type { Editor } from "@tiptap/core";

// A selection can contain headings and normal paragraphs at once. Formatting
// must cover each selected block, including the empty paragraph after a heading.
export function indentTextBlocks(editor: Editor, direction: number): boolean {
  if (editor.isActive("listItem"))
    return direction > 0
      ? editor.commands.sinkListItem("listItem")
      : editor.commands.liftListItem("listItem");
  return editor.commands.command(({ state, tr, dispatch }) => {
    let changed = false;
    state.doc.nodesBetween(
      state.selection.from,
      state.selection.to,
      (node, pos) => {
        if (node.type.name !== "paragraph" && node.type.name !== "heading")
          return;
        const current = Number(node.attrs.indent) || 0;
        const indent = Math.min(8, Math.max(0, current + direction));
        if (current === indent) return;
        if (dispatch)
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
        changed = true;
      },
    );
    return changed;
  });
}

export function setTextBlockLineHeight(editor: Editor, lineHeight: string) {
  return editor
    .chain()
    .updateAttributes("paragraph", { lineHeight: lineHeight || null })
    .updateAttributes("heading", { lineHeight: lineHeight || null })
    .run();
}
