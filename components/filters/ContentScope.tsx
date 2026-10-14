import type { AppState } from "../../lib/study/legacy";
import HierarchyField from "./HierarchyPicker";
export default function ContentScope({
  state,
  folders,
  nodes,
  onFolders,
  onNodes,
}: {
  state: AppState;
  folders: string[];
  nodes: string[];
  onFolders: (ids: string[]) => void;
  onNodes: (ids: string[]) => void;
}) {
  return (
    <div className="content-scope">
      <HierarchyField
        label="Temas de Biblioteca"
        items={state.folders}
        value={folders}
        multiple
        rootLabel="Todos los temas"
        onChange={(ids: string[]) => {
          onFolders(ids);
          onNodes([]);
        }}
      />
      {state.studyNodes.length > 0 && (
        <HierarchyField
          label="Apartados del temario"
          items={state.studyNodes}
          value={nodes}
          multiple
          rootLabel="Todo el temario"
          onChange={(ids: string[]) => {
            onNodes(ids);
            onFolders([]);
          }}
        />
      )}
    </div>
  );
}
