"use client";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import {
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import { useEngine } from "../SyncContext";
import { materialImage, isMaterialImageId } from "../../lib/material/images";
import { MaterialImageServices } from "./MaterialImageServices";
declare module "@tiptap/core" {
  interface Storage {
    materialImage: { selectedId: string | null };
  }
}
function ImageView({ node, selected, editor, getPos }: NodeViewProps) {
  const engine = useEngine(),
    services = useContext(MaterialImageServices);
  const asset = useSyncExternalStore(
    engine.subscribe,
    () => materialImage(engine.state.settings, node.attrs.imageId),
    () => null,
  );
  const [url, setUrl] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl("");
    setError(false);
    if (asset)
      void services.url(asset).then(
        (value) => {
          if (alive) setUrl(value);
        },
        () => {
          if (alive) setError(true);
        },
      );
    return () => {
      alive = false;
    };
  }, [asset?.key, asset?.url, services]);
  return (
    <NodeViewWrapper
      as="figure"
      className={`material-image ${selected ? "is-selected" : ""}`}
      contentEditable={false}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const pos = getPos();
        if (typeof pos === "number") {
          editor.storage.materialImage.selectedId = node.attrs.imageId;
          editor.commands.setNodeSelection(pos);
        }
      }}
      data-align={node.attrs.align}
      style={{ width: node.attrs.width + "%" }}
    >
      {url ? (
        <img
          src={url}
          onError={() => {
            setUrl("");
            setError(true);
          }}
          alt={node.attrs.alt || asset?.name || "Imagen de estudio"}
          draggable="true"
          data-drag-handle
        />
      ) : (
        <span className="material-image-status" role="status">
          {error
            ? "No se pudo abrir la imagen. Comprueba la conexión y vuelve a abrir el apartado."
            : asset
              ? "Cargando imagen…"
              : "Imagen no disponible en esta cuenta"}
        </span>
      )}
    </NodeViewWrapper>
  );
}
export const MaterialImage = Node.create({
  name: "materialImage",
  addStorage() {
    return { selectedId: null as string | null };
  },
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-material-image"),
        renderHTML: (attrs) => ({ "data-material-image": attrs.imageId }),
      },
      alt: { default: "", parseHTML: (el) => el.getAttribute("alt") || "" },
      width: {
        default: 100,
        parseHTML: (el) =>
          Math.max(
            10,
            Math.min(100, Number(el.getAttribute("data-width")) || 100),
          ),
        renderHTML: (attrs) => ({
          "data-width": Math.max(10, Math.min(100, Number(attrs.width) || 100)),
        }),
      },
      align: {
        default: "center",
        parseHTML: (el) =>
          ["left", "right"].includes(el.getAttribute("data-align") || "")
            ? el.getAttribute("data-align")
            : "center",
        renderHTML: (attrs) => ({
          "data-align": ["left", "right"].includes(attrs.align)
            ? attrs.align
            : "center",
        }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "img[data-material-image]",
        getAttrs: (el) =>
          isMaterialImageId(
            (el as HTMLElement).getAttribute("data-material-image"),
          )
            ? null
            : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
