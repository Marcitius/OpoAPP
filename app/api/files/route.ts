import { getBucket, ownerFromRequest } from "@/db";

const MAX_DIRECT_FILE_SIZE = 6 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "documento";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Selecciona un archivo" }, { status: 400 });
    }
    if (file.size > MAX_DIRECT_FILE_SIZE) {
      return Response.json({ error: "Este archivo debe subirse por partes" }, { status: 413 });
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      return Response.json({ error: "Solo se admiten PDF e imágenes" }, { status: 415 });
    }

    const owner = ownerFromRequest(request);
    const id = crypto.randomUUID();
    const key = `${encodeURIComponent(owner)}/${id}-${safeName(file.name)}`;
    await (await getBucket()).put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: file.name, owner },
    });

    return Response.json({
      attachment: {
        id,
        key,
        name: file.name,
        type: file.type,
        size: file.size,
        url: `/api/files?key=${encodeURIComponent(key)}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo subir el archivo";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) return Response.json({ error: "Falta el archivo" }, { status: 400 });

    const owner = ownerFromRequest(request);
    if (!key.startsWith(`${encodeURIComponent(owner)}/`)) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }

    const object = await (await getBucket()).get(key);
    if (!object) return Response.json({ error: "Archivo no encontrado" }, { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, max-age=3600");
    headers.set("content-disposition", "inline");
    return new Response(object.body, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo abrir el archivo";
    return Response.json({ error: message }, { status: 500 });
  }
}
