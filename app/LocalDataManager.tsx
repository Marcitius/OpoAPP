"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import AccountScreen from "../components/account/AccountScreen";
import Icon from "../components/shared/Icon";
import { useEngine } from "../components/SyncContext";
import { supabase } from "../lib/auth/client";
import { fingerprint, parseLegacy, validateState } from "../lib/data/legacy";
import { readAccount } from "../lib/data/local";
import { operation } from "../lib/data/models";
import {
  preparePortableBackup,
  restorePortableAssets,
} from "../lib/data/files";
export default function LocalDataManager({
  email,
  recoveryRequest = false,
}: {
  email: string;
  recoveryRequest?: boolean;
}) {
  const e = useEngine(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [, refresh] = useState(0),
    file = useRef<HTMLInputElement>(null);
  const [recovery, setRecovery] = useState(false),
    [password, setPassword] = useState("");
  useEffect(() => {
    if (recoveryRequest) {
      setRecovery(true);
      setOpen(true);
    }
  }, [recoveryRequest]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("opogc:account", show);
    return () => window.removeEventListener("opogc:account", show);
  }, []);
  useEffect(() => e.subscribe(() => refresh((x) => x + 1)), [e]);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setOpen(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  async function exportData() {
    setBusy(true);
    setMessage("");
    try {
      const backup = await preparePortableBackup(e);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `OpoGC-progreso-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Copia exportada con historial y anotaciones.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    setBusy(true);
    setMessage("");
    try {
      const parsed = JSON.parse(await f.text());
      const source = parseLegacy(parsed);
      if (!source)
        throw new Error(
          "No contiene una copia de progreso compatible. Para importar solo una estructura usa Más → Organizar temario → Importar.",
        );
      validateState(source);
      const mark = await fingerprint(source);
      const restored = await restorePortableAssets(source, parsed.assets ?? {});
      await e.migrate(restored, mark);
      if (Array.isArray(parsed.extraRecords))
        await e.enqueue(
          parsed.extraRecords.map((r: any) => {
            if (!["annotations", "nodeStates"].includes(r.kind))
              throw new Error("Tipo de registro de copia no permitido.");
            const originalItems = [...source.cards, ...source.psychTests];
            const newItems = [...restored.cards, ...restored.psychTests];
            const oldItem = originalItems.find(
              (x) => x.attachment?.key === r.data.key,
            );
            const newKey = oldItem
              ? newItems.find((x) => x.id === oldItem.id)?.attachment?.key
              : null;
            const id = newKey ? r.id.replace(r.data.key, newKey) : r.id;
            return operation(
              r.kind,
              id,
              newKey ? { ...r.data, key: newKey } : r.data,
            );
          }),
        );
      setMessage(
        e.status.pending
          ? "Copia incorporada en este dispositivo; se enviará al recuperar la conexión."
          : "Copia incorporada. Historial y relaciones conservados.",
      );
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await e.flush();
      const { error } = await supabase().auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <input
        hidden
        ref={file}
        type="file"
        accept=".json,application/json"
        onChange={importData}
      />
      {open && (
        <AccountScreen
          email={email}
          busy={busy}
          onClose={() => setOpen(false)}
          status={
            e.status.phase === "saved"
              ? "Todo guardado"
              : e.status.phase === "offline"
                ? "Sin conexión · se guardará después"
                : e.status.phase === "error"
                  ? "Guardado en este dispositivo"
                  : "Guardando…"
          }
        >
          {e.status.message && (
            <p className="account-notice">
              Hay cambios pendientes de guardar. Tu progreso se conserva en este
              dispositivo.
            </p>
          )}
          <section className="settings-group">
            <h3 className="ux-label">DATOS</h3>
            <button
              className="settings-row"
              disabled={busy}
              onClick={exportData}
            >
              <Icon name="download" />
              <span>
                <strong>Exportar copia</strong>
                <small>Progreso, historial y archivos</small>
              </span>
              <Icon name="chevron" size={18} />
            </button>
            <button
              className="settings-row"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              <Icon name="upload" />
              <span>
                <strong>Importar copia</strong>
                <small>Incorporar tus datos sin borrar los actuales</small>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          </section>
          <section className="settings-group">
            <h3 className="ux-label">SEGURIDAD</h3>
            <details
              className="password-settings"
              open={recovery ? true : undefined}
            >
              <summary>
                {recovery
                  ? "Establecer nueva contraseña"
                  : "Cambiar contraseña"}
                <Icon name="chevron" size={18} />
              </summary>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button
                className="primary-button full"
                disabled={busy || password.length < 8}
                onClick={async () => {
                  setBusy(true);
                  const { error } = await supabase().auth.updateUser({
                    password,
                  });
                  setMessage(error?.message ?? "Contraseña actualizada.");
                  setRecovery(false);
                  setPassword("");
                  setBusy(false);
                }}
              >
                Guardar contraseña
              </button>
            </details>
          </section>
          <section className="settings-group">
            <h3 className="ux-label">SESIÓN</h3>
            <button
              className="settings-row danger-text"
              disabled={busy}
              onClick={logout}
            >
              <span>
                <strong>Cerrar sesión</strong>
                <small>En este dispositivo</small>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          </section>
          {e.status.pending > 0 && (
            <p className="ux-footnote">
              Los cambios pendientes se conservan en este dispositivo y se
              enviarán cuando vuelvas a entrar con esta cuenta.
            </p>
          )}
          {busy && (
            <p role="status" className="account-notice">
              Un momento…
            </p>
          )}
          {message && (
            <p role="status" className="account-notice">
              {message}
            </p>
          )}
        </AccountScreen>
      )}
    </>
  );
}
