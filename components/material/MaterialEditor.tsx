"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import type { EditorOptions } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { materialExtensions } from "./extensions";
import {
  clipboardMaterial,
  markdownToMaterial,
  sanitizeMaterial,
} from "../../lib/material/format";
import useMaterialImages from "./useMaterialImages";
import BottomSheet from "../sheets/BottomSheet";
export default function MaterialEditor({
  html,
  onChange,
  readOnly = false,
  onReady,
  onUploading,
}: {
  html: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  onReady?: (e: Editor) => void;
  onUploading?: (busy: boolean) => void;
}) {
  const change = useRef(onChange);
  change.current = onChange;
  const [tools, setTools] = useState(false),
    [paste, setPaste] = useState(false),
    [raw, setRaw] = useState(""),
    [link, setLink] = useState(false),
    [url, setUrl] = useState("");
  const instance = useRef<Editor | null>(null);
  const selectedImageId = useRef<string | null>(null);
  const imageFile = useRef<HTMLInputElement>(null);
  const images = useMaterialImages(instance, onUploading);
  const [imageOptions, setImageOptions] = useState(false),
    [imageAlt, setImageAlt] = useState("");
  // Configure the view once. Reapplying editorProps/content on every local
  // transaction can disturb native deletion/composition and the DOM selection.
  const options = useMemo<Partial<EditorOptions>>(
    () => ({
      extensions: materialExtensions(),
      content: sanitizeMaterial(html),
      autofocus: false,
      editable: !readOnly,
      editorProps: {
        handleKeyDown: (_view, event) => {
          const editor = instance.current;
          if (event.key !== "Tab" || !editor) return false;
          if (editor.isActive("table")) {
            event.stopPropagation();
            return false;
          }
          if (editor.isActive("listItem")) {
            event.preventDefault();
            event.stopPropagation();
            return event.shiftKey
              ? editor.commands.liftListItem("listItem")
              : editor.commands.sinkListItem("listItem");
          }
          const type = editor.isActive("heading") ? "heading" : "paragraph",
            current = editor.getAttributes(type).indent || 0;
          if (event.shiftKey && !current) return false;
          event.preventDefault();
          event.stopPropagation();
          return editor.commands.updateAttributes(type, {
            indent: Math.min(
              8,
              Math.max(0, current + (event.shiftKey ? -1 : 1)),
            ),
          });
        },
        attributes: {
          class: "material-prose",
          role: "textbox",
          "aria-label": "Contenido del apartado",
          "aria-multiline": "true",
          tabindex: "0",
        },
        handleDrop: (view, event, _slice, moved) => {
          const files = Array.from(event.dataTransfer?.files ?? []).filter(
            (f) => f.type.startsWith("image/"),
          );
          if (!files.length || moved || !instance.current?.isEditable)
            return false;
          event.preventDefault();
          void images.insert.current(
            files,
            view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos,
          );
          return true;
        },
        handlePaste: (_view, event) => {
          const cb = event.clipboardData;
          const files = Array.from(cb?.files ?? []).filter((f) =>
            f.type.startsWith("image/"),
          );
          if (files.length && instance.current?.isEditable) {
            event.preventDefault();
            // A rich clipboard may contain both text and files. Preserve its
            // formatted text rather than dropping it when adding the images.
            const prose = new DOMParser().parseFromString(
              clipboardMaterial(
                cb?.getData("text/html") || "",
                cb?.getData("text/plain") || "",
              ),
              "text/html",
            );
            prose.querySelectorAll("img").forEach((image) => image.remove());
            if (prose.body.textContent?.trim())
              instance.current.commands.insertContent(prose.body.innerHTML);
            void images.insert.current(files);
            return true;
          }
          if (!cb) return false;
          const text = cb.getData("text/plain"),
            rich = cb.getData("text/html");
          if (!text && !rich) return false;
          event.preventDefault();
          instance.current?.commands.insertContent(
            clipboardMaterial(rich, text),
          );
          return true;
        },
      },
      onUpdate: ({ editor }) =>
        change.current(sanitizeMaterial(editor.getHTML())),
    }),
    [],
  );
  const editor = useEditor({ ...options, immediatelyRender: false });
  instance.current = editor;
  useEffect(() => {
    if (editor) {
      onReady?.(editor);
    }
  }, [editor]);
  useEffect(() => {
    if (editor && sanitizeMaterial(editor.getHTML()) !== sanitizeMaterial(html))
      editor.commands.setContent(sanitizeMaterial(html), { emitUpdate: false });
  }, [html, editor]);
  useEffect(() => {
    if (editor && editor.isEditable === readOnly)
      editor.setEditable(!readOnly, false);
  }, [readOnly, editor]);
  // Re-render the toolbar only on editor transactions, without rebuilding the document.
  useEditorState({ editor, selector: (ctx) => ctx.editor?.state });
  if (!editor) return <p role="status">Preparando documento…</p>;
  const act = (run: (e: Editor) => void) => {
    editor.view.dispatch(closeHistory(editor.state.tr));
    run(editor);
  };
  const button = (
    label: string,
    text: string,
    run: (e: Editor) => void,
    active = false,
    disabled = false,
  ) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => act(run)}
    >
      {text}
    </button>
  );
  if (editor.storage.materialImage?.selectedId)
    selectedImageId.current = editor.storage.materialImage.selectedId;
  if (editor.isActive("materialImage"))
    selectedImageId.current = editor.getAttributes("materialImage").imageId;
  let hasImages = false;
  let imageAttrs: Record<string, any> = {};
  editor.state.doc.descendants((node) => {
    if (node.type.name === "materialImage") {
      hasImages = true;
      if (node.attrs.imageId === selectedImageId.current)
        imageAttrs = node.attrs;
    }
  });
  const imageSelected = Object.hasOwn(imageAttrs, "imageId");
  // Toolbar controls keep targeting the selected image when a native select or
  // description sheet takes DOM focus. Never delete the current text selection.
  const selectImage = () => {
    let pos: number | undefined;
    editor.state.doc.descendants((node, index) => {
      if (
        node.type.name === "materialImage" &&
        node.attrs.imageId === selectedImageId.current
      )
        pos = index;
    });
    return pos !== undefined && editor.commands.setNodeSelection(pos);
  };
  const updateImage = (attrs: Record<string, any>) => {
    if (selectImage()) editor.commands.updateAttributes("materialImage", attrs);
  };
  const indent = (direction: number) => {
    if (editor.isActive("listItem")) {
      direction > 0
        ? editor.commands.sinkListItem("listItem")
        : editor.commands.liftListItem("listItem");
      return;
    }
    const type = editor.isActive("heading") ? "heading" : "paragraph";
    editor.commands.updateAttributes(type, {
      indent: Math.min(
        8,
        Math.max(0, (editor.getAttributes(type).indent || 0) + direction),
      ),
    });
  };
  return (
    <div className="material-editor">
      {!readOnly && (
        <div
          className="material-toolbar"
          role="toolbar"
          aria-label="Formato del documento"
        >
          <div className="material-toolbar-primary">
            <select
              aria-label="Estilo de párrafo"
              value={
                editor.isActive("heading")
                  ? String(editor.getAttributes("heading").level)
                  : "0"
              }
              onChange={(e) => {
                const level = Number(e.target.value);
                level
                  ? editor.commands.setHeading({
                      level: level as 1 | 2 | 3 | 4 | 5 | 6,
                    })
                  : editor.commands.setParagraph();
              }}
            >
              <option value="0">Texto normal</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  Título {n}
                </option>
              ))}
            </select>
            {button(
              "Negrita",
              "B",
              (e) => {
                e.commands.toggleBold();
              },
              editor.isActive("bold"),
            )}
            {button(
              "Cursiva",
              "I",
              (e) => {
                e.commands.toggleItalic();
              },
              editor.isActive("italic"),
            )}
            {button(
              "Subrayado",
              "U",
              (e) => {
                e.commands.toggleUnderline();
              },
              editor.isActive("underline"),
            )}
            {button(
              "Resaltar",
              "▰",
              (e) => {
                e.commands.toggleHighlight({ color: "#fff19b" });
              },
              editor.isActive("highlight"),
            )}
            {button(
              "Lista con viñetas",
              "•",
              (e) => {
                e.commands.toggleBulletList();
              },
              editor.isActive("bulletList"),
            )}
            {button("Insertar imagen", "Imagen", () =>
              imageFile.current?.click(),
            )}
            {button("Más formato", "···", () => setTools((v) => !v), tools)}
          </div>
          {hasImages && (
            <div
              className="material-toolbar-extra"
              aria-label="Formato de imagen"
            >
              <label>
                Tamaño{" "}
                <select
                  disabled={!imageSelected}
                  aria-label="Tamaño de imagen"
                  value={imageAttrs?.width || 100}
                  onChange={(e) =>
                    updateImage({
                      width: Number(e.target.value),
                    })
                  }
                >
                  {[25, 50, 75, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}%
                    </option>
                  ))}
                </select>
              </label>
              <select
                disabled={!imageSelected}
                aria-label="Alineación de imagen"
                value={imageAttrs?.align || "center"}
                onChange={(e) =>
                  updateImage({
                    align: e.target.value,
                  })
                }
              >
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
              {button(
                "Descripción de imagen",
                "Descripción",
                () => {
                  setImageAlt(imageAttrs?.alt || "");
                  setImageOptions(true);
                },
                false,
                !imageSelected,
              )}
              {button(
                "Quitar imagen",
                "Quitar imagen",
                (e) => {
                  if (selectImage()) e.commands.deleteSelection();
                },
                false,
                !imageSelected,
              )}
            </div>
          )}
          {tools && (
            <div className="material-toolbar-extra">
              <label>
                Fuente
                <select
                  aria-label="Fuente"
                  value={editor.getAttributes("textStyle").fontFamily || ""}
                  onChange={(e) =>
                    editor.commands.setFontFamily(e.target.value)
                  }
                >
                  <option value="">Sistema</option>
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="'Times New Roman'">Times New Roman</option>
                  <option value="monospace">Monoespaciada</option>
                </select>
              </label>
              <label>
                Tamaño
                <select
                  aria-label="Tamaño de letra"
                  value={editor.getAttributes("textStyle").fontSize || ""}
                  onChange={(e) =>
                    e.target.value
                      ? editor.commands.setFontSize(e.target.value)
                      : editor.commands.unsetFontSize()
                  }
                >
                  <option value="">Normal</option>
                  {[12, 14, 16, 18, 20, 24, 28, 32].map((n) => (
                    <option key={n} value={n + "px"}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Color
                <input
                  aria-label="Color del texto"
                  type="color"
                  defaultValue="#253b31"
                  onChange={(e) => editor.commands.setColor(e.target.value)}
                />
              </label>
              <label>
                Resaltado
                <input
                  aria-label="Color de resaltado"
                  type="color"
                  defaultValue="#fff19b"
                  onChange={(e) =>
                    editor.commands.setHighlight({ color: e.target.value })
                  }
                />
              </label>
              {button("Tachado", "S̶", (e) => {
                e.commands.toggleStrike();
              })}
              {button("Lista numerada", "1.", (e) => {
                e.commands.toggleOrderedList();
                e.commands.updateAttributes("orderedList", { type: null });
              })}
              {button("Lista alfabética", "a)", (e) => {
                if (!e.isActive("orderedList")) e.commands.toggleOrderedList();
                e.commands.updateAttributes("orderedList", { type: "a" });
              })}
              {button("Reducir sangría", "←", () => indent(-1))}
              {button("Aumentar sangría", "→", () => indent(1))}
              <select
                aria-label="Alineación"
                value={
                  editor.getAttributes(
                    editor.isActive("heading") ? "heading" : "paragraph",
                  ).textAlign || "left"
                }
                onChange={(e) => editor.commands.setTextAlign(e.target.value)}
              >
                {[
                  ["left", "Izquierda"],
                  ["center", "Centro"],
                  ["right", "Derecha"],
                  ["justify", "Justificado"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                aria-label="Interlineado"
                defaultValue=""
                onChange={(e) =>
                  editor.commands.updateAttributes(
                    editor.isActive("heading") ? "heading" : "paragraph",
                    { lineHeight: e.target.value || null },
                  )
                }
              >
                <option value="">Interlineado</option>
                {[1, 1.25, 1.5, 1.75, 2].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {button("Superíndice", "x²", (e) => {
                e.commands.toggleSuperscript();
              })}
              {button("Subíndice", "x₂", (e) => {
                e.commands.toggleSubscript();
              })}
              {button("Cita", "❝", (e) => {
                e.commands.toggleBlockquote();
              })}
              {button("Separador", "―", (e) => {
                e.commands.setHorizontalRule();
              })}
              {button("Enlace", "Enlace", () => {
                setUrl(editor.getAttributes("link").href || "");
                setLink(true);
              })}
              {button("Insertar tabla", "Tabla", (e) => {
                e.commands.insertTable({
                  rows: 3,
                  cols: 3,
                  withHeaderRow: true,
                });
              })}
              {editor.isActive("table") && (
                <>
                  {button("Añadir fila", "+ Fila", (e) => {
                    e.commands.addRowAfter();
                  })}
                  {button("Añadir columna", "+ Columna", (e) => {
                    e.commands.addColumnAfter();
                  })}
                  {button("Eliminar fila", "− Fila", (e) => {
                    e.commands.deleteRow();
                  })}
                  {button("Eliminar columna", "− Columna", (e) => {
                    e.commands.deleteColumn();
                  })}
                  {button("Combinar celdas", "Combinar", (e) => {
                    e.commands.mergeCells();
                  })}
                  {button("Separar celdas", "Separar", (e) => {
                    e.commands.splitCell();
                  })}
                  {button("Eliminar tabla", "Quitar tabla", (e) => {
                    e.commands.deleteTable();
                  })}
                </>
              )}
              {button("Deshacer", "↶", (e) => {
                e.commands.undo();
              })}
              {button("Rehacer", "↷", (e) => {
                e.commands.redo();
              })}
              {button("Quitar formato", "Tx", (e) => {
                e.chain().unsetAllMarks().clearNodes().run();
              })}
              {button("Pegar texto de ChatGPT", "Pegar Markdown", () =>
                setPaste(true),
              )}
            </div>
          )}
        </div>
      )}
      <input
        ref={imageFile}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Seleccionar imágenes"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void images.insert.current(files);
        }}
      />
      {images.message && (
        <p
          className="material-image-message"
          role={images.busy ? "status" : "alert"}
        >
          {images.message}
        </p>
      )}
      <EditorContent editor={editor} />
      {imageOptions && (
        <BottomSheet
          title="Descripción de imagen"
          onClose={() => setImageOptions(false)}
        >
          <label>
            Descripción{" "}
            <input
              aria-label="Descripción de imagen"
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
            />
          </label>
          <button
            className="primary-button full"
            onClick={() => {
              updateImage({
                alt: imageAlt.slice(0, 500),
              });
              setImageOptions(false);
            }}
          >
            Guardar descripción
          </button>
        </BottomSheet>
      )}
      {paste && (
        <BottomSheet
          title="Pegar texto de ChatGPT"
          onClose={() => setPaste(false)}
        >
          <p>
            Pega aquí texto con títulos, listas y Markdown. Se insertará con
            formato en la posición del cursor.
          </p>
          <textarea
            aria-label="Texto con Markdown"
            rows={9}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <button
            className="primary-button full"
            disabled={!raw.trim()}
            onClick={() => {
              editor.commands.insertContent(markdownToMaterial(raw));
              setRaw("");
              setPaste(false);
            }}
          >
            Insertar con formato
          </button>
        </BottomSheet>
      )}
      {link && (
        <BottomSheet title="Enlace" onClose={() => setLink(false)}>
          <input
            type="url"
            aria-label="Dirección del enlace"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="primary-button full"
            onClick={() => {
              if (!url.trim()) editor.commands.unsetLink();
              else if (/^(https?:\/\/|mailto:)/i.test(url))
                editor.commands.setLink({ href: url });
              else return;
              setLink(false);
            }}
          >
            Aplicar enlace
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
