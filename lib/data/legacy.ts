import { emptyState, type LegacyState } from "./models";
import { readValue, writeValue } from "./local";
import { mergeImport } from "../sync/engine";
export function parseLegacy(value: any): LegacyState | null {
  if (typeof value === "string") {
    try {
      return parseLegacy(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  if (value.state) return parseLegacy(value.state);
  if (
    ["folders", "cards", "reviews", "psychTests"].every((k) =>
      Array.isArray(value[k]),
    )
  )
    return {
      ...emptyState(),
      ...value,
      studyNodes: value.studyNodes ?? [],
      studyTasks: value.studyTasks ?? [],
      settings: { ...emptyState().settings, ...value.settings },
    };
  if (Array.isArray(value.studyNodes) && Array.isArray(value.studyTasks))
    return { ...emptyState(), ...value };
  // Study-only export from 9.17: preserve the tree, planned reviews and full supplied history.
  if (value.arbol && Array.isArray(value.elementos)) {
    const s = emptyState();
    const walk = (nodes: any[], parentId: string | null) =>
      nodes.forEach((n, i) => {
        const id = String(
          n.id ?? `import:${parentId ?? "root"}:${i}:${n.name ?? n.nombre}`,
        );
        s.studyNodes.push({
          id,
          name: String(n.name ?? n.nombre),
          parentId,
          createdAt: "1970-01-01T00:00:00.000Z",
        });
        walk(n.children ?? n.hijos ?? [], id);
      });
    walk(value.arbol, null);
    value.elementos.forEach((n: any) => {
      (n.historial ?? []).forEach((h: any, i: number) =>
        s.studyTasks.push({
          id: `history:${n.id}:${h.fecha}:${i}`,
          nodeId: String(n.id),
          plannedFor: String(h.fecha ?? "").slice(0, 10),
          note: h.nota_previa ?? "",
          reason: h.motivo ?? "",
          status: "done",
          createdAt: h.fecha,
          completedAt: h.fecha,
          assessment: h.resultado ?? null,
          completionNote: h.comentario_resultado ?? "",
          queueOrder: i,
        }),
      );
      (n.pendientes ?? []).forEach((h: any, i: number) =>
        s.studyTasks.push({
          id: `pending:${n.id}:${h.fecha}:${i}`,
          nodeId: String(n.id),
          plannedFor: h.fecha,
          note: h.nota ?? "",
          reason: h.motivo ?? "",
          status: "pending",
          createdAt: "1970-01-01T00:00:00.000Z",
          completedAt: null,
          assessment: null,
          completionNote: "",
          queueOrder: h.orden ?? i,
        }),
      );
    });
    return s;
  }
  return null;
}
export async function fingerprint(state: LegacyState) {
  const raw = new TextEncoder().encode(JSON.stringify(state));
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return [...new Uint8Array(hash)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export interface LegacyCandidate {
  state: LegacyState;
  fingerprint: string;
  sources: string[];
}
export async function detectLegacy(): Promise<LegacyCandidate | null> {
  const saved = await readValue<LegacyCandidate>("legacy", "candidate");
  if (saved) return saved;
  const found: LegacyState[] = [];
  const sources: string[] = [];
  const add = (value: unknown, source: string) => {
    const s = parseLegacy(value);
    if (s) {
      found.push(s);
      sources.push(source);
    }
  };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (/opogc|opo.?gc|study.*state/i.test(key) && !key.includes("auth"))
        add(localStorage.getItem(key), key);
    }
  } catch {}
  // Never fetch the old shared cloud endpoint. Only inspect same-origin, already-cached data.
  if ("caches" in window)
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys())
        if (new URL(req.url).pathname === "/api/state") {
          try {
            add(await (await cache.match(req))!.json(), name);
          } catch {}
        }
    }
  if (indexedDB.databases) {
    for (const meta of await indexedDB.databases()) {
      if (
        !meta.name ||
        meta.name === "opogc-account-v10" ||
        !/opo|study/i.test(meta.name)
      )
        continue;
      await new Promise<void>((resolve) => {
        const r = indexedDB.open(meta.name!);
        r.onerror = () => resolve();
        r.onsuccess = () => {
          const db = r.result;
          const stores = [...db.objectStoreNames];
          if (!stores.length) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction(stores);
          stores.forEach((name) => {
            const cursor = tx.objectStore(name).openCursor();
            cursor.onsuccess = () => {
              const c = cursor.result;
              if (c) {
                add(c.value, meta.name! + "/" + name);
                if (c.value?.key && c.value?.blob)
                  void writeValue(
                    "blobs",
                    "legacy:" + c.value.key,
                    c.value.blob,
                  );
                c.continue();
              }
            };
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        };
      });
    }
  }
  if (!found.length) return null;
  const state = found.reduce(mergeImport, emptyState());
  const candidate = { state, fingerprint: await fingerprint(state), sources };
  await writeValue("legacy", "candidate", candidate);
  return candidate;
}
export function validateState(s: LegacyState) {
  const unique = (items: any[], label: string) => {
    const ids = new Set();
    for (const x of items) {
      if (!x || typeof x.id !== "string" || !x.id || ids.has(x.id))
        throw new Error(`IDs vacíos o duplicados en ${label}.`);
      ids.add(x.id);
    }
    return ids;
  };
  const nodes = unique(s.studyNodes, "temario"),
    folders = unique(s.folders, "carpetas"),
    cards = unique(s.cards, "tarjetas");
  unique(s.reviews, "respuestas");
  unique(s.studyTasks, "repasos");
  unique(s.psychTests, "psicotécnicos");
  for (const [items, ids] of [
    [s.studyNodes, nodes],
    [s.folders, folders],
  ] as const) {
    for (const n of items) {
      if (n.parentId && !ids.has(n.parentId))
        throw new Error("El archivo contiene una relación padre ausente.");
      const seen = new Set([n.id]);
      let p = n.parentId;
      while (p) {
        if (seen.has(p)) throw new Error("El árbol contiene un ciclo.");
        seen.add(p);
        p = items.find((x) => x.id === p)?.parentId;
      }
    }
  }
  if (
    s.cards.some((c) => !folders.has(c.folderId)) ||
    s.reviews.some((r) => !cards.has(r.cardId)) ||
    s.studyTasks.some((t) => !nodes.has(t.nodeId))
  )
    throw new Error(
      "El archivo tiene referencias a elementos ausentes. Importa la copia completa.",
    );
}
