import { getBucket, ownerFromRequest } from "@/db";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_PART_SIZE = 6 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "documento";
}

function isAllowedType(type: string) {
  return type.startsWith("image/") || type === "application/pdf";
}

function ownsKey(request: Request, key: string) {
  return key.startsWith(`${encodeURIComponent(ownerFromRequest(request))}/`);
}

export async function POST(request: Request) {
  try {
    const action = new URL(request.url).searchParams.get("action") ?? "init";
    const bucket = await getBucket();

    if (action === "init") {
      const payload = (await request.json()) as { name?: string; type?: string; size?: number };
      const name = payload.name?.trim() ?? "";
      const type = payload.type?.trim() || "application/octet-stream";
      const size = Number(payload.size ?? 0);

      if (!name || !Number.isFinite(size) || size <= 0) {
        return Response.json({ error: "El archivo no es válido" }, { status: 400 });
      }
      if (size > MAX_FILE_SIZE) {
        return Response.json({ error: "El archivo no puede superar 100 MB" }, { status: 413 });
      }
      if (!isAllowedType(type)) {
        return Response.json({ error: "Solo se admiten PDF e imágenes" }, { status: 415 });
      }

      const owner = ownerFromRequest(request);
      const id = crypto.randomUUID();
      const key = `${encodeURIComponent(owner)}/${id}-${safeName(name)}`;
      const upload = await bucket.createMultipartUpload(key, {
        httpMetadata: { contentType: type },
        customMetadata: { originalName: name, owner },
      });

      return Response.json({ id, key, uploadId: upload.uploadId });
    }

    if (action === "complete") {
      const payload = (await request.json()) as {
        id?: string;
        key?: string;
        uploadId?: string;
        name?: string;
        type?: string;
        size?: number;
        parts?: Array<{ partNumber: number; etag: string }>;
      };

      if (!payload.id || !payload.key || !payload.uploadId || !payload.name || !payload.parts?.length) {
        return Response.json({ error: "Faltan datos para completar la subida" }, { status: 400 });
      }
      if (!ownsKey(request, payload.key)) {
        return Response.json({ error: "No autorizado" }, { status: 403 });
      }

      const upload = bucket.resumeMultipartUpload(payload.key, payload.uploadId);
      await upload.complete(payload.parts);

      return Response.json({
        attachment: {
          id: payload.id,
          key: payload.key,
          name: payload.name,
          type: payload.type || "application/octet-stream",
          size: Number(payload.size ?? 0),
          url: `/api/files?key=${encodeURIComponent(payload.key)}`,
        },
      });
    }

    return Response.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo preparar la subida";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const uploadId = url.searchParams.get("uploadId");
    const partNumber = Number(url.searchParams.get("partNumber"));
    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !request.body) {
      return Response.json({ error: "Parte de archivo no válida" }, { status: 400 });
    }
    if (!ownsKey(request, key)) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
    if (contentLength > MAX_PART_SIZE) {
      return Response.json({ error: "La parte del archivo es demasiado grande" }, { status: 413 });
    }

    const bucket = await getBucket();
    const upload = bucket.resumeMultipartUpload(key, uploadId);
    const part = await upload.uploadPart(partNumber, request.body);
    return Response.json({ partNumber: part.partNumber, etag: part.etag });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo subir una parte del archivo";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const uploadId = url.searchParams.get("uploadId");
    if (!key || !uploadId || !ownsKey(request, key)) {
      return Response.json({ error: "Subida no válida" }, { status: 400 });
    }
    const bucket = await getBucket();
    await bucket.resumeMultipartUpload(key, uploadId).abort();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
