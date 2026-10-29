import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { MaterialImage } from "./MaterialImage";
export const MaterialLayout = Extension.create({
  name: "materialLayout",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (e) => e.style.lineHeight || null,
            renderHTML: (a) =>
              a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {},
          },
          indent: {
            default: 0,
            parseHTML: (e) =>
              Number(e.getAttribute("data-indent")) ||
              Math.round(parseFloat(e.style.marginLeft || "0") / 24),
            renderHTML: (a) =>
              a.indent
                ? {
                    "data-indent": a.indent,
                    style: `margin-left: ${Math.min(8, a.indent) * 24}px`,
                  }
                : {},
          },
        },
      },
      {
        types: ["orderedList"],
        attributes: {
          type: {
            default: null,
            parseHTML: (e) => e.getAttribute("type"),
            renderHTML: (a) => (a.type ? { type: a.type } : {}),
          },
        },
      },
    ];
  },
});
export const materialExtensions = () => [
  StarterKit.configure({
    link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    heading: { levels: [1, 2, 3, 4, 5, 6] },
  }),
  TextStyleKit,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TableKit.configure({ table: { resizable: true } }),
  Subscript,
  Superscript,
  MaterialLayout,
  MaterialImage,
];
