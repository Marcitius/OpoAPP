import { Upload } from "tus-js-client";
import { supabase } from "../auth/client";
import { readAccount, readValue, writeValue } from "./local";
import { operation, rowKey, type JsonRecord, type LegacyState } from "./models";
import type { SyncEngine } from "../sync/engine";
export interface Attachment {
  id: string;
  key: string;
  name: string;
  type: string;
  size: number;
  url: string;
}
const bucket = "opogc-private";
const urls = new Map<string, string>();
async function userId() {
  const { data } = await supabase().auth.getSession();
  if (!data.session)
    throw new Error("Inicia sesión para acceder a tus archivos.");
  return data.session.user.id;
}
export async function uploadAttachment(
  file: File,
  onProgress?: (percent: number) => void,
  stableId?: string,
): Promise<Attachment> {
  if (!navigator.onLine)
    throw new Error(
      "Para añadir un archivo necesitas conexión. Puedes seguir estudiando con los archivos ya abiertos.",
    );
  if (file.size > 50 * 1024 * 1024)
    throw new Error("El plan gratuito admite archivos de hasta 50 MB.");
  if (
    ![
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ].includes(file.type)
  )
    throw new Error("Selecciona un PDF o una imagen PNG, JPEG, WebP o GIF.");
  const client = supabase(),
    user = await userId(),
    id = stableId ?? crypto.randomUUID(),
    key = user + "/" + id;
  if (file.size <= 6 * 1024 * 1024) {
    const { error } = await client.storage
      .from(bucket)
      .upload(key, file, { contentType: file.type, upsert: !!stableId });
    if (error) throw error;
    onProgress?.(100);
  } else {
    const {
      data: { session },
    } = await client.auth.getSession();
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint:
          process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/upload/resumable",
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session!.access_token}`,
          "x-upsert": stableId ? "true" : "false",
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        metadata: {
          bucketName: bucket,
          objectName: key,
          contentType: file.type,
          cacheControl: "3600",
        },
        onError: reject,
        onProgress: (a, b) => onProgress?.(Math.round((a / b) * 100)),
        onSuccess: () => resolve(),
      });
      upload.start();
    });
  }
  await writeValue("blobs", user + ":" + key, file);
  return {
    id,
    key,
    name: file.name,
    type: file.type,
    size: file.size,
    url: "supabase://" + key,
  };
}
export async function attachmentBlob(a: Pick<Attachment, "key" | "url">) {
  const user = await userId();
  const cached = await readValue<Blob>("blobs", user + ":" + a.key);
  if (cached) return cached;
  let blob: Blob;
  if (a.url.startsWith("supabase://")) {
    if (!a.key.startsWith(user + "/"))
      throw new Error(
        "Este archivo pertenece a otra cuenta. Importa una copia portátil.",
      );
    const { data, error } = await supabase()
      .storage.from(bucket)
      .download(a.key);
    if (error) throw error;
    blob = data;
  } else {
    const legacy = await readValue<Blob>("blobs", "legacy:" + a.key);
    if (legacy) return legacy;
    const response = await fetch(a.url);
    if (!response.ok)
      throw new Error(
        "No se puede recuperar el archivo antiguo. Importa una copia que incluya sus archivos.",
      );
    blob = await response.blob();
  }
  await writeValue("blobs", user + ":" + a.key, blob);
  return blob;
}
export async function attachmentUrl(a: Pick<Attachment, "key" | "url">) {
  const cacheKey = (await userId()) + ":" + a.key;
  if (urls.has(cacheKey)) return urls.get(cacheKey)!;
  const url = URL.createObjectURL(await attachmentBlob(a));
  urls.set(cacheKey, url);
  return url;
}
export function releaseFileUrls() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
export type AnnotationDocument = {
  version: 1;
  pages: Record<string, JsonRecord[]>;
};
export async function readAnnotations(
  engine: SyncEngine,
  key: string,
): Promise<AnnotationDocument> {
  const a = await readAccount(engine.user);
  const pages: AnnotationDocument["pages"] = {};
  Object.values(a.rows)
    .filter((r) => r.kind === "annotations" && !r.deleted && r.data.key === key)
    .sort((a, b) =>
      String(a.data.stroke.createdAt ?? a.data.stroke.id).localeCompare(
        String(b.data.stroke.createdAt ?? b.data.stroke.id),
      ),
    )
    .forEach((r) => (pages[r.data.page] ??= []).push(r.data.stroke));
  return { version: 1, pages };
}
export async function saveAnnotations(
  engine: SyncEngine,
  key: string,
  before: AnnotationDocument,
  next: AnnotationDocument,
) {
  const a = await readAccount(engine.user),
    ops = [];
  const flat = (doc: AnnotationDocument) =>
    new Map(
      Object.entries(doc.pages).flatMap(([page, strokes]) =>
        strokes.map(
          (stroke) =>
            [
              key + ":" + page + ":" + stroke.id,
              { key, page, stroke },
            ] as const,
        ),
      ),
    );
  const old = flat(before),
    after = flat(next);
  for (const [id, data] of after)
    if (JSON.stringify(data) !== JSON.stringify(old.get(id)))
      ops.push(
        operation(
          "annotations",
          id,
          data,
          a.rows[rowKey("annotations", id)]?.revision,
        ),
      );
  for (const id of old.keys())
    if (!after.has(id))
      ops.push(
        operation(
          "annotations",
          id,
          {},
          a.rows[rowKey("annotations", id)]?.revision,
          true,
        ),
      );
  if (ops.length) await engine.enqueue(ops);
}
const attachments = (state: LegacyState) =>
  [...state.cards, ...state.psychTests]
    .map((x) => x.attachment)
    .filter(Boolean) as Attachment[];
export async function preparePortableBackup(engine: SyncEngine) {
  await engine.flush();
  const state = structuredClone(engine.state),
    a = await readAccount(engine.user);
  const assets: Record<string, { name: string; type: string; base64: string }> =
    {};
  for (const file of attachments(state)) {
    if (assets[file.key]) continue;
    const blob = await attachmentBlob(file);
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    assets[file.key] = { name: file.name, type: file.type, base64 };
  }
  const extraRecords = Object.values(a.rows).filter(
    (r) => ["annotations", "nodeStates"].includes(r.kind) && !r.deleted,
  );
  return {
    format: "OpoGC-export",
    version: 10,
    exportedAt: new Date().toISOString(),
    state,
    assets,
    extraRecords,
    rejectedOperations: a.rejectedOperations ?? [],
  };
}
export async function restorePortableAssets(
  state: LegacyState,
  assets: Record<string, { name: string; type: string; base64: string }>,
) {
  const next = structuredClone(state),
    mapping = new Map<string, Attachment>();
  const user = await userId();
  for (const file of attachments(next)) {
    if (mapping.has(file.key)) continue;
    if (file.url.startsWith("supabase://") && file.key.startsWith(user + "/")) {
      mapping.set(file.key, file);
      continue;
    }
    const portable = assets[file.key];
    let blob: Blob;
    if (portable) {
      const bytes = Uint8Array.from(atob(portable.base64), (x) =>
        x.charCodeAt(0),
      );
      blob = new Blob([bytes], { type: portable.type });
    } else blob = await attachmentBlob(file);
    const uploaded = await uploadAttachment(
      new File([blob], file.name, { type: file.type || blob.type }),
      undefined,
      "import-" + file.id,
    );
    mapping.set(file.key, uploaded);
  }
  for (const x of [...next.cards, ...next.psychTests])
    if (x.attachment) x.attachment = mapping.get(x.attachment.key);
  return next;
}
