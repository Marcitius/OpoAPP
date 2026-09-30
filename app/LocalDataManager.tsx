"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
          "No contiene una copia de progreso compatible. Para importar solo una estructura usa Estudio → Importar temario.",
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
      <button
        className="account-fab"
        onClick={() => setOpen(true)}
        aria-label="Cuenta y copias"
      >
        Cuenta
      </button>
      {open && (
        <div
          className="modal-backdrop account-backdrop"
          onMouseDown={() => !busy && setOpen(false)}
        >
          <section
            className="account-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="account-close"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2 id="account-title">Tu cuenta</h2>
            <p className="account-email">{email}</p>
            <p role="status">
              {e.status.phase === "saved"
                ? "Todos los cambios guardados"
                : e.status.phase === "offline"
                  ? "Sin conexión · cambios guardados aquí"
                  : e.status.phase === "error"
                    ? "Conexión pendiente · cambios guardados aquí"
                    : "Guardando…"}
              {e.status.pending
                ? ` · ${e.status.pending} operaciones pendientes`
                : ""}
            </p>
            {e.status.message && (
              <p className="account-notice">{e.status.message}</p>
            )}
            <p>
              El progreso se comparte automáticamente entre tus dispositivos al
              iniciar sesión con esta cuenta.
            </p>
            <button
              className="primary-button full"
              disabled={busy}
              onClick={exportData}
            >
              Exportar copia de seguridad
            </button>
            <button
              className="secondary-button full"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              Importar copia de seguridad
            </button>
            <input
              hidden
              ref={file}
              type="file"
              accept=".json,application/json"
              onChange={importData}
            />
            <details open={recovery ? true : undefined}>
              <summary>
                {recovery
                  ? "Establecer nueva contraseña"
                  : "Cambiar contraseña"}
              </summary>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(x) => setPassword(x.target.value)}
                />
              </label>
              <button
                className="secondary-button full"
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
            <button
              className="secondary-button full"
              disabled={busy}
              onClick={logout}
            >
              Cerrar sesión en este dispositivo
            </button>
            {e.status.pending > 0 && (
              <p className="account-small">
                Las operaciones pendientes permanecen en este dispositivo y se
                enviarán al volver a entrar con esta cuenta.
              </p>
            )}
            {message && (
              <p role="status" className="account-notice">
                {message}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
