"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type AnyRecord = Record<string, any>;
type AppStateLike = {
  version?: number;
  folders: AnyRecord[];
  cards: AnyRecord[];
  reviews: AnyRecord[];
  psychTests: AnyRecord[];
  settings: AnyRecord;
};

type BusyAction = "export" | "import" | "cloud" | null;

function isObject(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAppStateLike(value: unknown): value is AppStateLike {
  if (!isObject(value)) return false;
  return Array.isArray(value.folders)
    && Array.isArray(value.cards)
    && Array.isArray(value.reviews)
    && Array.isArray(value.psychTests)
    && isObject(value.settings);
}

function unwrapState(value: unknown): AppStateLike | null {
  if (isAppStateLike(value)) return value;
  if (isObject(value) && isAppStateLike(value.state)) return value.state;
  return null;
}

function byId(items: AnyRecord[]) {
  const map = new Map<string, AnyRecord>();
  for (const item of items) {
    if (item && typeof item.id === "string" && item.id) map.set(item.id, item);
  }
  return map;
}

function unionById(local: AnyRecord[], incoming: AnyRecord[]) {
  const map = byId(local);
  for (const item of incoming) {
    if (item && typeof item.id === "string" && item.id) map.set(item.id, item);
  }
  return [...map.values()];
}

function timestamp(value: unknown) {
  if (typeof value !== "string" || !value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cardProgressScore(card: AnyRecord) {
  return [
    Number(card.reviewCount ?? 0),
    timestamp(card.lastReviewedAt),
    Number(card.repetitions ?? 0),
    Number(card.successCount ?? 0),
    Number(card.lapses ?? 0),
  ];
}

function compareScores(a: number[], b: number[]) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = Number(a[index] ?? 0) - Number(b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const CARD_PROGRESS_FIELDS = [
  "dueAt",
  "lastReviewedAt",
  "intervalDays",
  "ease",
  "repetitions",
  "lapses",
  "streak",
  "reviewCount",
  "successCount",
  "fsrsStability",
  "fsrsDifficulty",
  "orthographyStage",
] as const;

function mergeCard(local: AnyRecord, incoming: AnyRecord) {
  // The imported copy wins for content/organisation because importing is an
  // explicit user action. Scheduling/progress is preserved from whichever
  // copy has advanced further, so importing an older JSON does not roll FSRS
  // progress backwards.
  const merged: AnyRecord = { ...local, ...incoming };
  const progressSource = compareScores(cardProgressScore(incoming), cardProgressScore(local)) >= 0
    ? incoming
    : local;
  for (const field of CARD_PROGRESS_FIELDS) {
    if (field in progressSource) merged[field] = progressSource[field];
  }
  return merged;
}

function mergeCards(local: AnyRecord[], incoming: AnyRecord[]) {
  const localMap = byId(local);
  const result = new Map(localMap);
  for (const card of incoming) {
    if (!card || typeof card.id !== "string" || !card.id) continue;
    const existing = localMap.get(card.id);
    result.set(card.id, existing ? mergeCard(existing, card) : card);
  }
  return [...result.values()];
}

function mergePsychTests(local: AnyRecord[], incoming: AnyRecord[]) {
  const result = byId(local);
  for (const test of incoming) {
    if (!test || typeof test.id !== "string" || !test.id) continue;
    const existing = result.get(test.id);
    if (!existing) {
      result.set(test.id, test);
      continue;
    }
    result.set(test.id, {
      ...existing,
      ...test,
      attempts: unionById(
        Array.isArray(existing.attempts) ? existing.attempts : [],
        Array.isArray(test.attempts) ? test.attempts : [],
      ),
    });
  }
  return [...result.values()];
}

function mergeStates(local: AppStateLike, incoming: AppStateLike): AppStateLike {
  const localSeed = Number(local.settings?.seedVersion ?? 0);
  const incomingSeed = Number(incoming.settings?.seedVersion ?? 0);
  return {
    version: Math.max(Number(local.version ?? 1), Number(incoming.version ?? 1)),
    folders: unionById(local.folders, incoming.folders),
    cards: mergeCards(local.cards, incoming.cards),
    reviews: unionById(local.reviews, incoming.reviews),
    psychTests: mergePsychTests(local.psychTests, incoming.psychTests),
    settings: {
      ...local.settings,
      ...incoming.settings,
      seedVersion: Math.max(localSeed, incomingSeed),
    },
  };
}

async function readCurrentState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo leer el progreso local");
  const payload = await response.json();
  const state = unwrapState(payload);
  if (!state) throw new Error("El progreso actual no tiene un formato válido");
  return state;
}

function exportFilename() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return `OpoGC-progreso-${date}-${time}.json`;
}

export default function LocalDataManager() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  async function exportProgress() {
    try {
      setBusy("export");
      setNotice("");
      const state = await readCurrentState();
      const exportDocument = {
        format: "OpoGC-export",
        version: 1,
        exportedAt: new Date().toISOString(),
        state,
      };
      const json = JSON.stringify(exportDocument, null, 2);
      const filename = exportFilename();
      const file = new File([json], filename, { type: "application/json" });

      const shareNavigator = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
        share?: (data?: ShareData) => Promise<void>;
      };
      if (shareNavigator.share && shareNavigator.canShare?.({ files: [file] })) {
        await shareNavigator.share({ files: [file], title: "Copia de progreso OpoGC" });
        setNotice("Copia preparada. Puedes guardarla en iCloud Drive desde Compartir.");
      } else {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        setNotice("JSON exportado correctamente.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : "No se pudo exportar el progreso");
    } finally {
      setBusy(null);
    }
  }

  async function importProgress(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setBusy("import");
      setNotice("");
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const incoming = unwrapState(parsed);
      if (!incoming) throw new Error("Ese archivo no contiene un progreso válido de OpoGC");

      const local = await readCurrentState();
      const merged = mergeStates(local, incoming);
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: merged }),
      });
      if (!response.ok) throw new Error("No se pudo guardar la fusión en este dispositivo");

      const addedReviews = Math.max(0, merged.reviews.length - local.reviews.length);
      const addedCards = Math.max(0, merged.cards.length - local.cards.length);
      alert(`Importación completada. Se han fusionado los datos sin borrar el historial local.\n\nTarjetas nuevas: ${addedCards}\nRespuestas nuevas: ${addedReviews}`);
      window.location.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo importar el progreso");
    } finally {
      setBusy(null);
    }
  }

  async function cloudBackup() {
    try {
      setBusy("cloud");
      setNotice("");
      const state = await readCurrentState();
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-opogc-force-cloud": "1",
        },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) {
        let message = `No se pudo crear la copia en nube (${response.status})`;
        try {
          const payload = await response.json();
          if (typeof payload?.error === "string") message = payload.error;
        } catch { /* keep status message */ }
        throw new Error(message);
      }
      setNotice("Copia en nube creada. El estudio normal sigue siendo 100 % local.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo crear la copia en nube");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Copias y transferencia de progreso"
        style={floatingButtonStyle}
      >
        Datos
      </button>

      {open ? (
        <div style={backdropStyle} role="presentation" onMouseDown={() => !busy && setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Datos y copias de OpoGC"
            style={panelStyle}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={headerStyle}>
              <div>
                <strong style={{ fontSize: 18 }}>Datos y copias</strong>
                <div style={subtitleStyle}>El estudio se guarda en este dispositivo. No hay sincronización automática con D1.</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={Boolean(busy)} style={closeStyle}>×</button>
            </div>

            <div style={infoStyle}>
              Para cambiar de dispositivo: exporta el JSON, guárdalo en iCloud Drive e impórtalo en el otro dispositivo. La importación fusiona el historial y conserva el progreso FSRS más avanzado de cada tarjeta.
            </div>

            <button type="button" onClick={exportProgress} disabled={Boolean(busy)} style={primaryButtonStyle}>
              {busy === "export" ? "Preparando…" : "Exportar progreso"}
            </button>

            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(busy)} style={secondaryButtonStyle}>
              {busy === "import" ? "Fusionando…" : "Importar y fusionar"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={importProgress}
              style={{ display: "none" }}
            />

            <button type="button" onClick={cloudBackup} disabled={Boolean(busy)} style={cloudButtonStyle}>
              {busy === "cloud" ? "Guardando en nube…" : "Crear copia en nube ahora"}
            </button>

            <div style={footnoteStyle}>
              La copia en nube es manual. Si no pulsas este botón, estudiar, hacer tests o repasar ortografía no escribe en D1.
            </div>

            {notice ? <div style={noticeStyle}>{notice}</div> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

const floatingButtonStyle: React.CSSProperties = {
  position: "fixed",
  right: 12,
  bottom: "calc(82px + env(safe-area-inset-bottom))",
  zIndex: 8500,
  border: "1px solid rgba(40, 89, 67, 0.18)",
  background: "rgba(255,255,255,0.96)",
  color: "#285943",
  borderRadius: 999,
  padding: "9px 13px",
  fontSize: 13,
  fontWeight: 700,
  boxShadow: "0 8px 24px rgba(27, 45, 37, 0.14)",
  WebkitBackdropFilter: "blur(12px)",
  backdropFilter: "blur(12px)",
};

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9000,
  background: "rgba(20, 27, 24, 0.38)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "16px 12px calc(16px + env(safe-area-inset-bottom))",
};

const panelStyle: React.CSSProperties = {
  width: "min(520px, 100%)",
  maxHeight: "min(720px, 88dvh)",
  overflowY: "auto",
  background: "#FDFCF9",
  color: "#24302B",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 24px 70px rgba(18, 27, 23, 0.24)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  justifyContent: "space-between",
  marginBottom: 14,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 5,
  fontSize: 13,
  lineHeight: 1.4,
  color: "#69736E",
};

const closeStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#45514B",
  fontSize: 28,
  lineHeight: 1,
  padding: "0 4px",
};

const infoStyle: React.CSSProperties = {
  background: "#F1F3EF",
  borderRadius: 14,
  padding: 12,
  fontSize: 13,
  lineHeight: 1.5,
  marginBottom: 14,
};

const baseButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  borderRadius: 13,
  padding: "11px 14px",
  fontSize: 15,
  fontWeight: 750,
  marginTop: 9,
};

const primaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: "1px solid #285943",
  background: "#285943",
  color: "white",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: "1px solid #C7CDC9",
  background: "white",
  color: "#293730",
};

const cloudButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  border: "1px solid #B9C5BF",
  background: "#EEF3F0",
  color: "#285943",
  marginTop: 18,
};

const footnoteStyle: React.CSSProperties = {
  marginTop: 9,
  color: "#717A76",
  fontSize: 12,
  lineHeight: 1.45,
};

const noticeStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 10,
  borderRadius: 11,
  background: "#FFF7D9",
  color: "#55491C",
  fontSize: 13,
  lineHeight: 1.4,
};
