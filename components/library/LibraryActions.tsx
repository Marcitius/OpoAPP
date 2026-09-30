import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";
import type { StudyMode } from "../../lib/study/legacy";
export default function LibraryActions({
  name,
  onClose,
  onNewFolder,
  onNewCard,
  onImport,
  onStudy,
  onMove,
  onDelete,
  onSelect,
  onWritten,
}: {
  name?: string;
  onClose: () => void;
  onNewFolder: () => void;
  onNewCard: () => void;
  onImport: () => void;
  onStudy: (mode: StudyMode) => void;
  onMove?: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
  onWritten?: () => void;
}) {
  const action = (fn: () => void) => {
    onClose();
    fn();
  };
  return (
    <BottomSheet title={name ?? "Biblioteca"} onClose={onClose}>
      <button className="sheet-action" onClick={() => action(onNewCard)}>
        <Icon name="plus" />
        Crear tarjeta
      </button>
      <button className="sheet-action" onClick={() => action(onNewFolder)}>
        <Icon name="folder" />
        Crear {name ? "subcarpeta" : "carpeta"}
      </button>
      <button className="sheet-action" onClick={() => action(onImport)}>
        <Icon name="upload" />
        Importar tarjetas JSON
      </button>
      <hr />
      <button
        className="sheet-action"
        onClick={() => action(() => onStudy("recommended"))}
      >
        Repaso programado
      </button>
      <button
        className="sheet-action"
        onClick={() => action(() => onStudy("learn"))}
      >
        Aprender {name ? "este tema" : "todo"}
      </button>
      <button
        className="sheet-action"
        onClick={() => action(() => onStudy("weakest"))}
      >
        Practicar más falladas
      </button>
      <button
        className="sheet-action"
        onClick={() => action(() => onStudy("random"))}
      >
        Repaso aleatorio
      </button>
      {onWritten && (
        <button className="sheet-action" onClick={() => action(onWritten)}>
          Practicar respuestas escritas
        </button>
      )}
      {onMove && (
        <>
          <hr />
          <button className="sheet-action" onClick={() => action(onMove)}>
            Mover esta carpeta
          </button>
        </>
      )}
      {onSelect && (
        <button className="sheet-action" onClick={() => action(onSelect)}>
          Seleccionar tarjetas
        </button>
      )}
      {onDelete && (
        <button
          className="sheet-action danger-text"
          onClick={() => action(onDelete)}
        >
          Eliminar esta carpeta
        </button>
      )}
    </BottomSheet>
  );
}
