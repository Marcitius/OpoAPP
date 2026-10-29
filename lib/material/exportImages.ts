import { sanitizeMaterial } from "./sanitize";
import { materialImage, validateMaterialImage } from "./images";
import type { Attachment } from "../data/files";
// Export embeds actual bytes; no expiring signed URLs or object URLs are written.
export async function exportMaterialImages(
  html: string,
  settings: Record<string, any>,
  read: (a: Attachment) => Promise<Blob>,
) {
  let output = sanitizeMaterial(html);
  const cache = new Map<string, string>();
  for (const match of output.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0],
      id = tag.match(/data-material-image="([^"]*)"/i)?.[1] ?? "";
    const asset = materialImage(settings, id);
    if (!asset)
      throw Error(
        "Falta una imagen en esta cuenta. Abre el apartado y comprueba que se ve antes de exportar.",
      );
    let data = cache.get(id);
    if (!data) {
      const blob = await read(asset);
      validateMaterialImage(blob);
      data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("No se pudo exportar la imagen."));
        reader.readAsDataURL(blob);
      });
      cache.set(id, data);
    }
    output = output.replace(tag, tag.replace(/>$/, ` src="${data}">`));
  }
  return output;
}
