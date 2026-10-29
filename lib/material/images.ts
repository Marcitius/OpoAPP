import type { Attachment } from "../data/files";
export const imageKey = (id: string) => "studyMaterialImage:" + id;
export const isMaterialImageId = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
export function materialImage(
  settings: Record<string, any>,
  id: string,
): Attachment | null {
  if (!isMaterialImageId(id)) return null;
  const record = settings[imageKey(id)],
    a = record?.attachment;
  return record?.version === 1 &&
    a &&
    typeof a.id === "string" &&
    typeof a.key === "string" &&
    typeof a.url === "string" &&
    typeof a.name === "string" &&
    ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(a.type) &&
    Number.isFinite(a.size)
    ? a
    : null;
}
export function materialImageAttachments(
  settings: Record<string, any>,
): Attachment[] {
  return Object.keys(settings)
    .filter((k) => k.startsWith("studyMaterialImage:"))
    .map((k) => materialImage(settings, k.slice("studyMaterialImage:".length)))
    .filter((a): a is Attachment => !!a);
}
export function remapMaterialImages(
  settings: Record<string, any>,
  mapping: Map<string, Attachment>,
) {
  return Object.fromEntries(
    Object.entries(settings).map(([k, v]) => {
      const a = k.startsWith("studyMaterialImage:")
        ? materialImage(settings, k.slice("studyMaterialImage:".length))
        : null;
      return [
        k,
        a && mapping.has(a.key) ? { ...v, attachment: mapping.get(a.key) } : v,
      ];
    }),
  );
}
export function validateMaterialImage(file: Pick<File, "type" | "size">) {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  )
    throw Error("Selecciona una imagen PNG, JPEG, WebP o GIF.");
  if (file.size > 50 * 1024 * 1024)
    throw Error("La imagen supera el máximo de 50 MB.");
}
