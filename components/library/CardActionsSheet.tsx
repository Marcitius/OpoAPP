"use client";
import HierarchyField from "../filters/HierarchyPicker";
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
  onSave,
  onDelete,
  onNotes,
  onDerive,
  onConnections,
  onEdit,
}: {
  card: Card;
  folders: Folder[];
  onClose: () => void;
  onMove: (folder: string) => void;
  onReorder: (direction: -1 | 1) => void;
  onSave: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onNotes?: () => void;
  onDerive?: () => void;
  onConnections?: () => void;
}) {
  const [destination, setDestination] = useState(card?.folderId ?? "");
  if (!card) return null;
  const parent = folders.find((f) => f.id === card.folderId)?.parentId;
  return (
    <BottomSheet
      title={plainRichText(card.front) || "Tarjeta"}
      onClose={onClose}
    >
      {onEdit && (
        <button
          className="sheet-action"
          onClick={() => {
            onClose();
            onEdit();
          }}
        >
          Editar tarjeta
        </button>
      )}
      {onNotes && (
        <button
          className="sheet-action"
          onClick={() => {
            onClose();
            onNotes();
          }}
        >
          Notas de la tarjeta
        </button>
      )}
      {onDerive && (
        <button
          className="sheet-action"
          onClick={() => {
            onClose();
            onDerive();
          }}
        >
          Crear tarjeta derivada
        </button>
      )}
      {onConnections && (
        <button
          className="sheet-action"
          onClick={() => {
            onClose();
            onConnections();
          }}
        >
          Tarjetas relacionadas
        </button>
      )}
      <button
        className="sheet-action"
        onClick={() => {
          onClose();
          onSave();
        }}
      >
        Guardar para repasar
      </button>
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
        <HierarchyField
          label="Carpeta de destino"
          items={folders}
          value={destination}
          onChange={setDestination}
          rootLabel="Biblioteca · nivel principal"
        />
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
      <button
        className="sheet-action danger-text"
        onClick={() => {
          onClose();
          onDelete();
        }}
      >
        Eliminar tarjeta
      </button>
      <p className="muted">
        La tarjeta conserva su historial y sus próximos repasos.
      </p>
    </BottomSheet>
  );
}
