import Icon from "../shared/Icon";
export type AppTab =
  | "today"
  | "study"
  | "review"
  | "progress"
  | "more"
  | "organize"
  | "library"
  | "psych";
const items = [
  { id: "today", label: "Hoy" },
  { id: "study", label: "Estudiar" },
  { id: "review", label: "Repasar" },
  { id: "progress", label: "Progreso" },
  { id: "more", label: "Más" },
] as const;
export default function AppNavigation({
  tab,
  onNavigate,
  status,
}: {
  tab: AppTab;
  onNavigate: (tab: AppTab) => void;
  status: string;
}) {
  const active = ["organize", "library", "psych"].includes(tab) ? "more" : tab;
  const links = items.map((item) => (
    <button
      key={item.id}
      aria-current={active === item.id ? "page" : undefined}
      className={active === item.id ? "active" : ""}
      onClick={() => onNavigate(item.id)}
    >
      <Icon name={item.id} />
      <span>{item.label}</span>
    </button>
  ));
  return (
    <>
      <aside className="ux-sidebar">
        <div className="ux-brand">
          <span className="ux-brand-icon">O</span>
          <div>
            <strong>OpoGC</strong>
            <small>Un poco más cerca.</small>
          </div>
        </div>
        <nav aria-label="Navegación principal">{links}</nav>
        <div className="ux-sidebar-foot">
          <span className="status-dot" />
          {status}
          <small>OpoGC v11 · Mobile UX</small>
        </div>
      </aside>
      <nav className="ux-bottom-nav" aria-label="Navegación principal móvil">
        {links}
      </nav>
    </>
  );
}
