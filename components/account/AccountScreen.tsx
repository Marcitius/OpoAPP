import type { ReactNode } from "react";
import BottomSheet from "../sheets/BottomSheet";
import Icon from "../shared/Icon";
export default function AccountScreen({
  email,
  status,
  busy,
  onClose,
  children,
}: {
  email: string;
  status: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <BottomSheet
      title="Cuenta"
      onClose={onClose}
      fullScreen
      className="account-settings-screen"
      dismissible={!busy}
    >
      <div className="settings-identity">
        <span>
          <Icon name="account" size={26} />
        </span>
        <div>
          <strong>{email}</strong>
          <small>Mi preparación</small>
        </div>
      </div>
      <section className="settings-group">
        <h3 className="ux-label">SINCRONIZACIÓN</h3>
        <div className="settings-status">
          <Icon name="check" size={20} />
          <span>
            {status}
            <small>Tu progreso continúa contigo en cada dispositivo.</small>
          </span>
        </div>
      </section>
      {children}
    </BottomSheet>
  );
}
