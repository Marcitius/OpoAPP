"use client";
import { useContext, useRef, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { useEngine } from "../SyncContext";
import { imageKey, validateMaterialImage } from "../../lib/material/images";
import { MaterialImageServices } from "./MaterialImageServices";
export default function useMaterialImages(
  instance: RefObject<Editor | null>,
  onUploading?: (busy: boolean) => void,
) {
  const engine = useEngine(),
    services = useContext(MaterialImageServices);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const working = useRef(false),
    callback = useRef(onUploading);
  callback.current = onUploading;
  const insert = async (files: File[], position?: number) => {
    const editor = instance.current;
    if (!editor || editor.isDestroyed || !editor.isEditable || !files.length)
      return;
    if (working.current) {
      setMessage("Espera a que termine de añadir la imagen.");
      return;
    }
    try {
      files.forEach(validateMaterialImage);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }
    working.current = true;
    setBusy(true);
    callback.current?.(true);
    setMessage("Añadiendo imagen…");
    if (position !== undefined) editor.commands.setTextSelection(position);
    let bookmark = editor.state.selection.getBookmark();
    const map = ({ transaction }: { transaction: { mapping: any } }) => {
      bookmark = bookmark.map(transaction.mapping);
    };
    editor.on("transaction", map);
    try {
      for (const file of files) {
        const asset = await services.upload(file, (percent) =>
          setMessage(`Añadiendo imagen… ${percent}%`),
        );
        if (!asset.key.startsWith(engine.user + "/"))
          throw Error("La cuenta ha cambiado. Vuelve a abrir el apartado.");
        const current = engine.state;
        await engine.update(current, {
          ...current,
          settings: {
            ...current.settings,
            [imageKey(asset.id)]: { version: 1, attachment: asset },
          },
        });
        if (editor.isDestroyed || !editor.isEditable)
          throw Error("Vuelve a abrir el apartado para añadir la imagen.");
        const selection = bookmark.resolve(editor.state.doc);
        editor.commands.insertContentAt(
          { from: selection.from, to: selection.to },
          {
            type: "materialImage",
            attrs: {
              imageId: asset.id,
              alt: file.name,
              width: 100,
              align: "center",
            },
          },
        );
        editor.commands.createParagraphNear();
        bookmark = editor.state.selection.getBookmark();
      }
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message || "No se pudo añadir la imagen.");
    } finally {
      editor.off("transaction", map);
      working.current = false;
      setBusy(false);
      callback.current?.(false);
    }
  };
  const latest = useRef(insert);
  latest.current = insert;
  return { busy, message, insert: latest };
}
