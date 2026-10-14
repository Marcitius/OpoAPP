"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { configurationError, supabase } from "../lib/auth/client";
import { SyncEngine } from "../lib/sync/engine";
import {
  detectLegacy,
  validateState,
  type LegacyCandidate,
} from "../lib/data/legacy";
import { readAccount } from "../lib/data/local";
import { SyncContext } from "./SyncContext";
import OpoApp from "../app/OpoApp";
import { restorePortableAssets, releaseFileUrls } from "../lib/data/files";
import LocalDataManager from "../app/LocalDataManager";
export default function AccountApp() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [engine, setEngine] = useState<SyncEngine | null>(null);
  const [legacy, setLegacy] = useState<LegacyCandidate | null>(null),
    [offer, setOffer] = useState(false),
    [migration, setMigration] = useState("");
  const [recovering, setRecovering] = useState(false);
  const config = configurationError();
  useEffect(() => {
    if (config) {
      setReady(true);
      return;
    }
    let active = true;
    void detectLegacy()
      .then((x) => {
        if (active) setLegacy(x);
      })
      .catch(() => {});
    const client = supabase();
    client.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [config]);
  useEffect(() => {
    if (!session?.user.id) {
      setEngine(null);
      return;
    }
    const e = new SyncEngine(session.user.id, supabase());
    setEngine(e);
    void e.start().catch((error) => setMigration(error.message));
    return () => {
      e.stop();
      releaseFileUrls();
    };
  }, [session?.user.id]);
  useEffect(() => {
    if (!session || !legacy) return;
    let active = true;
    readAccount(session.user.id).then((a) => {
      if (active) setOffer(!a.migrated.includes(legacy.fingerprint));
    });
    return () => {
      active = false;
    };
  }, [legacy, session?.user.id]);
  if (config)
    return (
      <main className="account-page">
        <section className="account-card">
          <div className="brand-mark">OG</div>
          <h1>Configura OpoGC</h1>
          <p>{config}</p>
          <p>Los pasos están en README.md, incluido el SQL de tu proyecto.</p>
        </section>
      </main>
    );
  if (!ready) return <main className="account-page">Abriendo tu cuenta…</main>;
  if (!session) return <AuthForm />;
  if (!engine)
    return <main className="account-page">Preparando tus datos…</main>;
  return (
    <SyncContext.Provider value={engine}>
      <OpoApp key={session.user.id} />
      <LocalDataManager
        email={session.user.email ?? ""}
        recoveryRequest={recovering}
      />
      {migration && (
        <div className="account-message" role="alert">
          {migration}
        </div>
      )}
      {offer && legacy && (
        <div className="modal-backdrop account-migration">
          <section
            className="account-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="migration-title"
          >
            <h2 id="migration-title">Continuar con tus datos anteriores</h2>
            <p>
              Se han encontrado {legacy.state.studyNodes.length} elementos de
              temario, {legacy.state.cards.length} tarjetas y{" "}
              {
                legacy.state.studyTasks.filter((t) => t.status === "done")
                  .length
              }{" "}
              registros de estudio en este dispositivo.
            </p>
            <p>
              ¿Quieres incorporarlos a {session.user.email}? Se conservará la
              copia original.
            </p>
            <button
              className="primary-button full"
              onClick={async () => {
                try {
                  setMigration("Importando…");
                  validateState(legacy.state);
                  const restored = await restorePortableAssets(
                    legacy.state,
                    {},
                  );
                  await engine.migrate(restored, legacy.fingerprint);
                  setOffer(false);
                  setMigration("");
                } catch (e) {
                  setMigration((e as Error).message);
                }
              }}
            >
              Importar a mi cuenta
            </button>
            <button
              className="secondary-button full"
              onClick={() => {
                setOffer(false);
                setMigration("");
              }}
            >
              Más tarde
            </button>
          </section>
        </div>
      )}
    </SyncContext.Provider>
  );
}
export function AuthForm() {
  const [mode, setMode] = useState<"login" | "register" | "recover">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const c = supabase();
      if (mode === "recover") {
        const { error } = await c.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/",
        });
        if (error) throw error;
        setMessage("Revisa tu correo para recuperar la contraseña.");
      } else if (mode === "register") {
        const { data, error } = await c.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: window.location.origin + "/",
          },
        });
        if (error) throw error;
        if (!data.session)
          setMessage(
            "Revisa tu correo y confirma la cuenta. Después podrás iniciar sesión.",
          );
      } else {
        const { error } = await c.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page">
      <section className="account-card">
        <div className="brand-mark">OG</div>
        <h1>
          {mode === "login"
            ? "Continúa tu estudio"
            : mode === "register"
              ? "Crea tu cuenta"
              : "Recupera tu contraseña"}
        </h1>
        <p>Tu temario, tus repasos y tu progreso en todos tus dispositivos.</p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Nombre
              <input
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Correo electrónico
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== "recover" && (
            <label>
              Contraseña
              <input
                type="password"
                required
                minLength={8}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {message && (
            <p role="status" className="account-notice">
              {message}
            </p>
          )}
          <button disabled={busy} className="primary-button full">
            {busy
              ? "Un momento…"
              : mode === "login"
                ? "Iniciar sesión"
                : mode === "register"
                  ? "Registrarme"
                  : "Enviar enlace"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setMessage("");
          }}
        >
          {mode === "login" ? "Crear una cuenta" : "Ya tengo cuenta"}
        </button>
        {mode === "login" && (
          <button className="text-button" onClick={() => setMode("recover")}>
            He olvidado mi contraseña
          </button>
        )}
      </section>
    </main>
  );
}
