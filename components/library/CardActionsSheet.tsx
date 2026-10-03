"use client";
import { useState } from "react";
import type { Card, Folder } from "../../lib/study/legacy";
import { flattenFolderTree, folderPathLabel } from "../../lib/study/legacy";
import { plainRichText } from "../../app/RichTextEditor";
import BottomSheet from "../sheets/BottomSheet";
export default function CardActionsSheet({
  card,
  folders,
  onClose,
  onMove,
  onReorder,
}: {
  card: Card;
  folders: Folder[];
  onClose: () => void;
  onMove: (folder: string) => void;
  onReorder: (direction: -1 | 1) => void;
}) {
  const [destination, setDestination] = useState(card?.folderId ?? "");
  if (!card) return null;
  const parent = folders.find((f) => f.id === card.folderId)?.parentId;
  return (
    <BottomSheet
      title={plainRichText(card.front) || "Tarjeta"}
      onClose={onClose}
    >
      <button
        className="sheet-action"
        onClick={() => {
          onReorder(-1);
          onClose();
        }}
      >
        Mover arriba
      </button>
      <button
        className="sheet-action"
        onClick={() => {
          onReorder(1);
          onClose();
        }}
      >
        Mover abajo
      </button>
      {parent && (
        <button
          className="sheet-action"
          onClick={() => {
            onMove(parent);
            onClose();
          }}
        >
          Sacar un nivel
        </button>
      )}
      <hr />
      <label>
        Mover a
        <select
          aria-label="Carpeta de destino"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        >
          {flattenFolderTree(folders).map(({ folder }) => (
            <option value={folder.id} key={folder.id}>
              {folderPathLabel(folders, folder.id)}
            </option>
          ))}
        </select>
      </label>
      <button
        className="primary-button full"
        disabled={destination === card.folderId}
        onClick={() => {
          onMove(destination);
          onClose();
        }}
      >
        Mover tarjeta
      </button>
      <p className="muted">
        La tarjeta conserva su historial y sus próximos repasos.
      </p>
    </BottomSheet>
  );
}
