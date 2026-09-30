import Icon from "../shared/Icon";
import type { AppTab } from "./AppNavigation";
export default function MorePage({
  onNavigate,
  onAccount,
  onSettings,
}: {
  onNavigate: (tab: AppTab) => void;
  onAccount: () => void;
  onSettings: () => void;
}) {
  const groups = [
    {
      label: "TU MATERIAL",
      items: [
        {
          icon: "folder",
          title: "Biblioteca",
          copy: "Tarjetas, carpetas e importaciones",
          action: () => onNavigate("library"),
        },
        {
          icon: "psych",
          title: "Psicotécnicos",
          copy: "Documentos, práctica e intentos",
          action: () => onNavigate("psych"),
        },
        {
          icon: "study",
          title: "Organizar temario",
          copy: "Crear, mover y planificar elementos",
          action: () => onNavigate("organize"),
        },
      ],
    },
    {
      label: "TU ESPACIO",
      items: [
        {
          icon: "account",
          title: "Cuenta y datos",
          copy: "Copias de seguridad y seguridad",
          action: onAccount,
        },
        {
          icon: "settings",
          title: "Preferencias de estudio",
          copy: "Tu ritmo de tarjetas",
          action: onSettings,
        },
      ],
    },
  ];
  return (
    <section className="ux-page more-page">
      <p className="ux-intro">Todo lo demás, cuando lo necesites.</p>
      {groups.map((group) => (
        <section className="settings-group" key={group.label}>
          <h2 className="ux-label">{group.label}</h2>
          {group.items.map((item) => (
            <button
              className="settings-row"
              key={item.title}
              onClick={item.action}
            >
              <span className="row-icon">
                <Icon name={item.icon} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.copy}</small>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          ))}
        </section>
      ))}
      <p className="ux-footnote">
        OpoGC v11 · Mobile UX
        <br />
        Organiza menos. Estudia más.
      </p>
    </section>
  );
}
