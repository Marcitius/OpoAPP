"use client";
import { useEffect, useRef, useState } from "react";
import type { MaterialNode } from "../../lib/material/model";
import {
  markdownToMaterial,
  sanitizeMaterial,
} from "../../lib/material/format";
import { readValue, writeValue } from "../../lib/data/local";
import BottomSheet from "../sheets/BottomSheet";
import MaterialEditor from "./MaterialEditor";
export type SaveResult = "saved" | "conflict" | "error";
export default function MaterialDocument({
  node,
  html,
  user,
  status,
  onSave,
  onClose,
  onCopy,
}: {
  node: MaterialNode;
  html: string;
  user: string;
  status: string;
  onSave: (html: string, expected: string) => Promise<SaveResult>;
  onClose: () => void;
  onCopy: (html: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(html),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(false),
    [conflict, setConflict] = useState(false),
    [reading, setReading] = useState(false),
    [importError, setImportError] = useState("");
  const live = useRef(html),
    base = useRef(html),
    submitted = useRef<string | null>(null),
    pending = useRef<Promise<boolean> | null>(null),
    latestSave = useRef(onSave),
    blocked = useRef(false),
    file = useRef<HTMLInputElement>(null);
  latestSave.current = onSave;
  const draftKey = "material-draft:" + user + ":" + node.id;
  useEffect(() => {
    let alive = true;
    void readValue<{ html: string; base: string }>("legacy", draftKey).then(
      (saved) => {
        if (!alive || !saved || live.current !== base.current) return;
        if (saved.html !== html) {
          live.current = saved.html;
          setDraft(saved.html);
          base.current = saved.base;
          if (saved.base !== html) {
            blocked.current = true;
            setConflict(true);
          }
        }
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (html === base.current) return;
    // The app publishes an optimistic value before its local transaction commits.
    // A failed save must keep the original base and the user's draft intact.
    if (html === submitted.current) return;
    if (live.current === base.current) {
      base.current = html;
      live.current = html;
      setDraft(html);
    } else {
      blocked.current = true;
      setConflict(true);
    }
  }, [html]);
  const change = (next: string) => {
    live.current = next;
    setDraft(next);
    setError(false);
    void writeValue("legacy", draftKey, {
      html: next,
      base: base.current,
    }).catch(() => setError(true));
  };
  async function flush(): Promise<boolean> {
    if (pending.current) {
      await pending.current;
      if (blocked.current) return false;
      return flush();
    }
    if (blocked.current) return false;
    if (live.current === base.current) return true;
    const next = live.current,
      expected = base.current;
    submitted.current = next;
    setSaving(true);
    const promise = (async () => {
      try {
        const result = await latestSave.current(next, expected);
        if (result === "saved") {
          base.current = next;
          if (live.current === next) await writeValue("legacy", draftKey, null);
          setError(false);
          return true;
        }
        if (result === "conflict") {
          blocked.current = true;
          setConflict(true);
        } else setError(true);
        return false;
      } catch {
        setError(true);
        return false;
      }
    })();
    pending.current = promise;
    const ok = await promise;
    pending.current = null;
    submitted.current = null;
    setSaving(false);
    return ok;
  }
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (draft === base.current || conflict || error) return;
    const timer = setTimeout(() => void flushRef.current(), 550);
    return () => clearTimeout(timer);
  }, [draft, conflict, error]);
  useEffect(() => {
    const hide = () => {
        if (document.visibilityState === "hidden") void flushRef.current();
      },
      leave = () => void flushRef.current();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
  }, []);
  async function close() {
    if (await flushRef.current()) onClose();
  }
  function download() {
    const blob = new Blob(
      [
        `<!doctype html><html lang="es"><meta charset="utf-8"><title>${node.name.replace(/[<>&"]/g, "")}</title><style>body{max-width:850px;margin:40px auto;padding:24px;font:16px/1.65 system-ui}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px}blockquote{border-left:3px solid #285943;padding-left:16px}</style><body>${sanitizeMaterial(live.current)}</body></html>`,
      ],
      { type: "text/html;charset=utf-8" },
    );
    const a = document.createElement("a"),
      url = URL.createObjectURL(blob);
    a.href = url;
    a.download =
      node.name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 90) + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <BottomSheet
      title={node.name}
      subtitle="Material de estudio"
      fullScreen
      className="material-sheet"
      dismissible={!saving}
      onClose={() => void close()}
    >
      <div className="material-document-actions">
        <button
          className="secondary-button"
          aria-pressed={reading}
          onClick={() => setReading((v) => !v)}
        >
          {reading ? "Editar contenido" : "Modo lectura"}
        </button>
        <span role="status">
          {conflict
            ? "Hay otra versión guardada"
            : error
              ? "No se pudo guardar"
              : saving || draft !== base.current
                ? "Guardando…"
                : status}
        </span>
        <button className="ux-link" onClick={() => void flush()}>
          Guardar
        </button>
        <button className="ux-link" onClick={() => file.current?.click()}>
          Importar texto
        </button>
        <button className="ux-link" onClick={download}>
          Exportar HTML
        </button>
        <button className="ux-link" onClick={() => window.print()}>
          Imprimir / PDF
        </button>
        <input
          ref={file}
          type="file"
          hidden
          accept=".txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html"
          aria-label="Importar archivo de texto"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 2_000_000) {
              setImportError(
                "Divide el archivo en apartados más pequeños (máximo 2 MB por importación).",
              );
              return;
            }
            try {
              const text = await f.text(),
                rich = /\.html?$/i.test(f.name)
                  ? sanitizeMaterial(text)
                  : markdownToMaterial(text);
              change(live.current + rich);
              setImportError("");
            } catch {
              setImportError(
                "No se pudo leer el archivo. Prueba a guardarlo como UTF-8.",
              );
            }
          }}
        />
      </div>
      {importError && <p role="alert">{importError}</p>}
      {error && (
        <div className="material-notice" role="alert">
          Tu texto sigue aquí y conserva una copia local.{" "}
          <button
            onClick={() => {
              setError(false);
              void flush();
            }}
          >
            Reintentar guardado
          </button>
        </div>
      )}
      {conflict && (
        <div className="material-notice" role="alert">
          <p>
            Este apartado cambió en otro dispositivo. Conservamos tu texto sin
            sobrescribir la otra versión.
          </p>
          <button
            className="primary-button"
            onClick={async () => {
              if (await onCopy(live.current)) {
                await writeValue("legacy", draftKey, null);
                onClose();
              }
            }}
          >
            Guardar mi texto como copia
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              if (
                !confirm(
                  "¿Descartar tus cambios locales y abrir la versión guardada?",
                )
              )
                return;
              base.current = html;
              live.current = html;
              blocked.current = false;
              setDraft(html);
              setConflict(false);
              void writeValue("legacy", draftKey, null);
            }}
          >
            Cargar versión guardada
          </button>
        </div>
      )}
      <MaterialEditor
        html={draft}
        onChange={change}
        readOnly={reading || conflict}
      />
    </BottomSheet>
  );
}
