// UI-only fixture: real v10 IndexedDB, differences and projection; no fixture data is compiled into the application.
import React, { Profiler, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MaterialImageServices } from "../../components/material/MaterialImageServices";
import OpoApp from "../../app/OpoApp";
import { SyncContext } from "../../components/SyncContext";
import { emptyState, operation } from "../../lib/data/models";
import {
  readAccount,
  transact,
  readValue,
  writeValue,
} from "../../lib/data/local";
import {
  flatten,
  project,
  differences,
  applyLocal,
  mergeRemote,
} from "../../lib/data/projection";
import { preparePortableBackup } from "../../lib/data/files";
import { parseLegacy, validateState } from "../../lib/data/legacy";
import BottomSheet from "../../components/sheets/BottomSheet";
import { ImageAnnotator } from "../../app/CardImage";
import PdfAnnotator from "../../app/PdfAnnotator";
import AccountScreen from "../../components/account/AccountScreen";
import "../../app/globals.css";
import "../../app/account.css";
import "../../app/mobile-ux.css";
import "../../app/material.css";
const user = "ux-fixture-a",
  stamp = new Date().toISOString();
const today = new Date().toLocaleDateString("en-CA");
const fixture = emptyState();
fixture.studyNodes = [
  {
    id: "root",
    name: "Derecho Constitucional",
    parentId: null,
    createdAt: stamp,
  },
  {
    id: "title",
    name: "Título IX · Tribunal Constitucional",
    parentId: "root",
    createdAt: stamp,
  },
  {
    id: "article",
    name: "Artículo 164 · Sentencias del Tribunal Constitucional",
    parentId: "title",
    createdAt: stamp,
  },
  {
    id: "article53",
    name: "Artículo 53 · Garantías de los derechos",
    parentId: "title",
    createdAt: stamp,
  },
  {
    id: "reforma",
    name: "Título X · Reforma constitucional",
    parentId: "root",
    createdAt: stamp,
  },
  {
    id: "reforma1",
    name: "Artículo 167 · Reforma ordinaria",
    parentId: "reforma",
    createdAt: stamp,
  },
  {
    id: "reforma2",
    name: "Artículo 168 · Reforma agravada",
    parentId: "reforma",
    createdAt: stamp,
  },
];
for (let i = 0; i < 12; i++)
  fixture.studyNodes.push({
    id: `deep-${i}`,
    name: `Nivel ${i + 1} · Apartado con un nombre largo para probar navegación profunda y orientación`,
    parentId: i ? `deep-${i - 1}` : "root",
    createdAt: stamp,
  });
fixture.studyTasks = [
  {
    id: "task164",
    nodeId: "article",
    plannedFor: today,
    note: "Me cuesta recordar la literalidad de los efectos frente a todos.",
    reason: "estudio",
    status: "pending",
    createdAt: stamp,
    completedAt: null,
    assessment: null,
    completionNote: "",
    queueOrder: 0,
  },
  {
    id: "task53",
    nodeId: "article53",
    plannedFor: today,
    note: "Recuerda las garantías y la sumariedad.",
    reason: "estudio",
    status: "pending",
    createdAt: stamp,
    completedAt: null,
    assessment: null,
    completionNote: "",
    queueOrder: 1,
  },
  {
    id: "task167",
    nodeId: "reforma1",
    plannedFor: today,
    note: "Primera lectura y repaso activo.",
    reason: "estudio",
    status: "pending",
    createdAt: stamp,
    completedAt: null,
    assessment: null,
    completionNote: "",
    queueOrder: 2,
  },
];
fixture.folders = [
  {
    id: "deck",
    name: "Constitución Española",
    parentId: null,
    color: "#285943",
    createdAt: stamp,
  },
  {
    id: "deck2",
    name: "Título IX · Tribunal Constitucional",
    parentId: "deck",
    color: "#285943",
    createdAt: stamp,
  },
];
function card(
  id: string,
  type: string,
  front: string,
  back: string,
  extra: any = {},
) {
  return {
    id,
    folderId: "deck2",
    type,
    front,
    back,
    options: [],
    correctOption: 0,
    correctOptions: [],
    dueAt: "2026-01-01T00:00:00Z",
    createdAt: stamp,
    lastReviewedAt: "2026-01-01T00:00:00Z",
    intervalDays: 1,
    ease: 0,
    repetitions: 1,
    lapses: 0,
    streak: 0,
    reviewCount: 1,
    successCount: 0,
    attachment: null,
    fsrsStability: 1,
    fsrsDifficulty: 5,
    orthographyIsCorrect: null,
    orthographyCorrectForm: "",
    orthographyExplanation: "",
    orthographySource: "",
    orthographyStage: 1,
    ...extra,
  };
}
fixture.cards = [
  card(
    "basic1",
    "basic",
    "<p>Artículo 53 CE</p><p>¿Qué garantías protegen los derechos del capítulo segundo?</p>",
    "<p>Vinculan a todos los poderes públicos. Solo por ley, que en todo caso deberá respetar su contenido esencial, podrá regularse su ejercicio.</p>",
  ),
  card(
    "basic2",
    "basic",
    "<p>Artículo 164 CE</p><p>¿Qué sentencias tienen plenos efectos frente a todos?</p>",
    "<p>Las que declaren la inconstitucionalidad de una ley o de una norma con fuerza de ley y todas las que no se limiten a la estimación subjetiva de un derecho.</p>",
  ),
  ...Array.from({ length: 4 }, (_, i) =>
    card(
      `basic${i + 3}`,
      "basic",
      `<p>Concepto de repaso ${i + 3}</p>`,
      `<p>Respuesta del concepto ${i + 3}.</p>`,
    ),
  ),
  card(
    "vocab",
    "choice",
    "Vocabulario: significado de «espabilar»",
    "Avivar el entendimiento.",
    {
      options: ["Avivar el entendimiento", "Dormir", "Posponer", "Olvidar"],
      correctOptions: [0],
    },
  ),
  card(
    "test",
    "test",
    "Test: ¿Qué cámara autoriza el referéndum consultivo?",
    "Lo autoriza previamente el Congreso de los Diputados.",
    {
      options: [
        "Congreso de los Diputados",
        "Senado",
        "Ambas cámaras",
        "Gobierno",
      ],
      correctOptions: [0],
    },
  ),
  card(
    "multi",
    "test",
    "Test múltiple: elige las dos primeras opciones",
    "Ambas son correctas.",
    {
      options: ["Primera", "Segunda", "Tercera", "Cuarta"],
      correctOptions: [0, 1],
    },
  ),
  card("ortho", "orthography", "espavilar", "La forma correcta es espabilar.", {
    orthographyIsCorrect: false,
    orthographyCorrectForm: "espabilar",
    orthographyExplanation: "Se escribe con b.",
  }),
  card(
    "written",
    "written",
    "Respuesta escrita: reproduce «contenido esencial»",
    "contenido esencial",
    {
      options: [
        "__OPOGC_WRITTEN_RUBRIC__:" +
          JSON.stringify({
            version: 1,
            tipo: "rubrica",
            criterios: [
              {
                id: "a",
                esperado: "contenido esencial",
                alternativas: [],
                puntos: 10,
                literal: true,
                critico: false,
                maximoSiFalla: null,
                minimoSimilitud: 0.8,
              },
            ],
            normalizacion: {
              ignorarMayusculas: true,
              ignorarAcentos: true,
              ignorarPuntuacion: true,
              ignorarEspaciosExtra: true,
            },
            umbrales: { otraVezHasta: 40, dificilHasta: 65, bienHasta: 85 },
          }),
      ],
    },
  ),
  card(
    "long",
    "basic",
    "Tarjeta larga: explica las garantías",
    Array.from(
      { length: 20 },
      (_, i) =>
        `<p>Parte ${i + 1}. Este contenido largo permite comprobar el scroll interior sin tapar la valoración ni mover el fondo de la aplicación.</p>`,
    ).join(""),
  ),
];
fixture.psychTests = [
  {
    id: "psico14",
    name: "Psico 14 · Vocabulario",
    category: "Vocabulario",
    totalQuestions: 80,
    attachment: null,
    createdAt: stamp,
    attempts: [
      {
        id: "attempt",
        date: stamp,
        correct: 60,
        wrong: 12,
        blank: 8,
        score: 7.25,
        minutes: 24,
        notes: "Repasar los sinónimos.",
      },
    ],
  },
  {
    id: "psico15",
    name: "Psico 15 · Series numéricas",
    category: "Razonamiento",
    totalQuestions: 40,
    attachment: null,
    createdAt: stamp,
    attempts: [],
  },
];
if (new URLSearchParams(location.search).has("mixed-plan"))
  fixture.studyTasks[0].reason = "literalidad";
if (new URLSearchParams(location.search).has("legacy-plan"))
  fixture.studyTasks.forEach((t) => (t.reason = "literalidad"));
if (new URLSearchParams(location.search).has("bulk")) {
  fixture.cards = Array.from(
    { length: new URLSearchParams(location.search).has("session69") ? 69 : 50 },
    (_, i) =>
      card(
        `bulk-${i}`,
        "basic",
        `Repaso consecutivo ${i + 1}`,
        `Respuesta ${i + 1}`,
      ),
  );
  fixture.settings.dailyReviewGoal = 80;
}
if (new URLSearchParams(location.search).has("learning")) {
  fixture.cards = fixture.cards.slice(0, 3).map((c) => ({
    ...c,
    reviewCount: 0,
    successCount: 0,
    repetitions: 0,
    lapses: 0,
    streak: 0,
    lastReviewedAt: null,
    intervalDays: 0,
    fsrsStability: 0,
    fsrsDifficulty: 0,
    dueAt: stamp,
  }));
}
if (new URLSearchParams(location.search).has("empty")) {
  fixture.studyNodes = [];
  fixture.studyTasks = [];
  fixture.cards = [];
  fixture.folders = [];
  fixture.psychTests = [];
}
if (new URLSearchParams(location.search).has("performance")) {
  const padding = "Texto de estudio para medir el rendimiento local. ".repeat(
    120,
  );
  fixture.cards.push(
    ...Array.from({ length: 2200 - fixture.cards.length }, (_, i) =>
      card(
        "perf-" + i,
        "basic",
        "Pregunta de rendimiento " + i,
        "<p>" + padding + "</p>",
      ),
    ),
  );
  fixture.reviews = Array.from({ length: 4000 }, (_, i) => ({
    id: "perf-review-" + i,
    cardId: fixture.cards[i % fixture.cards.length].id,
    rating: "good",
    correct: true,
    predictedRecall: 0.8,
    reviewedAt: "2026-10-01T10:00:00Z",
  }));
}
const timings: { kind: string; ms: number }[] = [];
let account = await readAccount(user);
if (!account.initialized)
  account = await transact(user, (a) => {
    applyLocal(
      a,
      Object.values(flatten(fixture)).map((r) =>
        operation(r.kind, r.id, r.data),
      ),
    );
    a.queue = [];
    a.initialized = true;
  });
let imageUploadGate: Promise<void> | undefined;
let releaseImageUpload: (() => void) | undefined;
let imageUploadHeld = false;
let failMaterialSave = false;
let materialSaveGate: Promise<void> | undefined;
let releaseMaterialSave: (() => void) | undefined;
let materialSaveHeld = false;
let failReviewSave = false;
let checkpointGate: Promise<void> | undefined;
let releaseCheckpoint: (() => void) | undefined;
let checkpointWaiting = false;
const listeners = new Set<() => void>();
const engine = {
  user,
  flush: async () => true,
  state: project(account.rows),
  status: { phase: "saved", pending: account.queue.length },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  update: async (before: any, next: any) => {
    const start = performance.now();
    if (
      materialSaveGate &&
      Object.keys(next.settings).some(
        (k) =>
          k.startsWith("studyMaterialContent:") &&
          JSON.stringify(next.settings[k]) !==
            JSON.stringify(before.settings[k]),
      )
    ) {
      const gate = materialSaveGate;
      materialSaveGate = undefined;
      materialSaveHeld = true;
      await gate;
      materialSaveHeld = false;
    }
    if (
      checkpointGate &&
      next.reviews.length === before.reviews.length &&
      Object.keys(next.settings).some(
        (k) =>
          k.startsWith("cardSession:") &&
          JSON.stringify(next.settings[k]) !==
            JSON.stringify(before.settings[k]),
      )
    ) {
      const gate = checkpointGate;
      checkpointGate = undefined;
      checkpointWaiting = true;
      await gate;
      checkpointWaiting = false;
    }
    if (failReviewSave && next.reviews.length > before.reviews.length) {
      failReviewSave = false;
      throw new Error("Fallo de valoración simulado");
    }
    if (
      failMaterialSave &&
      Object.keys(next.settings).some(
        (k) =>
          k.startsWith("studyMaterialContent:") &&
          JSON.stringify(next.settings[k]) !==
            JSON.stringify(before.settings[k]),
      )
    ) {
      failMaterialSave = false;
      throw new Error("Fallo de guardado simulado");
    }
    account = await transact(user, (a) =>
      applyLocal(a, differences(before, next, a)),
    );
    engine.state = project(account.rows);
    engine.status.pending = account.queue.length;
    listeners.forEach((fn) => fn());
    timings.push({ kind: "local-update", ms: performance.now() - start });
  },
};
window.addEventListener("offline", () => {
  engine.status.phase = "offline";
  listeners.forEach((fn) => fn());
});
window.addEventListener("online", () => {
  engine.status.phase = "saved";
  listeners.forEach((fn) => fn());
});
(window as any).__opogcQA = {
  state: () => engine.state,
  timings: () => timings,
  holdCheckpoint: () => {
    checkpointGate = new Promise<void>((resolve) => {
      releaseCheckpoint = resolve;
    });
  },
  checkpointWaiting: () => checkpointWaiting,
  releaseCheckpoint: () => {
    releaseCheckpoint?.();
  },
  failReviewSaveOnce: () => {
    failReviewSave = true;
  },
  resetTimings: () => {
    timings.length = 0;
  },
  draft: (key: string) => readValue("legacy", key),
  holdImageUpload: () => {
    imageUploadGate = new Promise<void>((resolve) => {
      releaseImageUpload = resolve;
    });
  },
  imageUploadHeld: () => imageUploadHeld,
  releaseImageUpload: () => {
    releaseImageUpload?.();
  },
  holdMaterialSave: () => {
    materialSaveGate = new Promise<void>((resolve) => {
      releaseMaterialSave = resolve;
    });
  },
  materialSaveHeld: () => materialSaveHeld,
  releaseMaterialSave: () => {
    releaseMaterialSave?.();
  },
  failMaterialSaveOnce: () => {
    failMaterialSave = true;
  },
  // Test-only sequential device handoff through the real projection, without a Supabase account.
  receive: async (snapshot: any) => {
    account = await transact(user, (a) => {
      a.queue = [];
      const revision = a.cursor + 1;
      mergeRemote(
        a,
        Object.values(flatten(snapshot)).map((r) => ({
          ...r,
          revision,
          deleted: false,
        })),
        revision,
      );
    });
    engine.state = project(account.rows);
    engine.status.pending = 0;
    listeners.forEach((fn) => fn());
  },
  account: () => readAccount(user),
  backup: () => preparePortableBackup(engine as any),
  roundtrip: (value: any) => {
    const parsed = parseLegacy(value);
    if (!parsed) throw new Error("Invalid backup");
    validateState(parsed);
    return parsed;
  },
};
function QAAccount() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("opogc:account", show);
    return () => window.removeEventListener("opogc:account", show);
  }, []);
  return open ? (
    <AccountScreen
      email="cuenta-de-pruebas@example.test"
      status="Todo guardado"
      busy={false}
      onClose={() => setOpen(false)}
    >
      <section className="settings-group">
        <h3 className="ux-label">DATOS</h3>
        <button className="settings-row">Exportar copia</button>
        <button className="settings-row">Importar copia</button>
      </section>
      <section className="settings-group">
        <h3 className="ux-label">SEGURIDAD</h3>
        <button className="settings-row">Cambiar contraseña</button>
      </section>
    </AccountScreen>
  ) : null;
}
function QAOverlayTest() {
  const [open, setOpen] = useState(
      new URLSearchParams(location.search).has("overlay"),
    ),
    [editor, setEditor] = useState<string | null>(null);
  const attachment = {
    id: "qa-attachment",
    size: 0,
    key: "qa-attachment",
    name: "qa-file",
    type: "image/png",
    url: "",
  };
  return open ? (
    <BottomSheet title="Formulario con adjunto" onClose={() => setOpen(false)}>
      <button onClick={() => setEditor("image")}>Abrir imagen de prueba</button>
      <button onClick={() => setEditor("pdf")}>Abrir PDF de prueba</button>
      {editor === "image" && (
        <ImageAnnotator
          attachment={attachment}
          title="Imagen de prueba"
          onClose={() => setEditor(null)}
        />
      )}{" "}
      {editor === "pdf" && (
        <PdfAnnotator
          attachment={attachment}
          title="PDF de prueba"
          onClose={() => setEditor(null)}
        />
      )}
    </BottomSheet>
  ) : null;
}
const testImages = {
  upload: async (file: File, progress?: (n: number) => void) => {
    if (imageUploadGate) {
      const gate = imageUploadGate;
      imageUploadGate = undefined;
      imageUploadHeld = true;
      await gate;
      imageUploadHeld = false;
    }
    if (!navigator.onLine)
      throw Error("Para añadir una imagen necesitas conexión.");
    const id = crypto.randomUUID(),
      key = user + "/" + id;
    await writeValue("blobs", user + ":" + key, file);
    progress?.(100);
    return {
      id,
      key,
      name: file.name,
      type: file.type,
      size: file.size,
      url: "supabase://" + key,
    };
  },
  blob: async (a: { key: string; url: string }) => {
    const blob = await readValue<Blob>("blobs", user + ":" + a.key);
    if (!blob) throw Error("Imagen no disponible.");
    return blob;
  },
  url: async (a: { key: string; url: string }) =>
    URL.createObjectURL(await testImages.blob(a)),
};
createRoot(document.getElementById("root")!).render(
  <SyncContext.Provider value={engine as any}>
    <MaterialImageServices.Provider value={testImages}>
      <Profiler
        id="app"
        onRender={(_id, _phase, ms) => {
          timings.push({ kind: "react", ms });
        }}
      >
        <OpoApp />
      </Profiler>
      <QAAccount />
      <QAOverlayTest />
    </MaterialImageServices.Provider>
  </SyncContext.Provider>,
);
