import { getBucket, ownerFromRequest } from "@/db";

const MAX_ANNOTATION_SIZE = 8 * 1024 * 1024;

function ownsKey(request: Request, key: string) {
  return key.startsWith(`${encodeURIComponent(ownerFromRequest(request))}/`);
}

function annotationKey(key: string) {
  return `${key}.opogc-annotations.json`;
}

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("key");
    if (!key) return Response.json({ error: "Falta el documento" }, { status: 400 });
    if (!ownsKey(request, key)) return Response.json({ error: "No autorizado" }, { status: 403 });

    const object = await (await getBucket()).get(annotationKey(key));
    if (!object) return Response.json({ annotations: { version: 1, pages: {} } });

    const annotations = await object.json();
    return Response.json({ annotations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron abrir las anotaciones";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_ANNOTATION_SIZE) {
      return Response.json({ error: "Las anotaciones son demasiado grandes" }, { status: 413 });
    }

    const payload = await request.json() as { key?: string; annotations?: unknown };
    if (!payload.key || !payload.annotations) {
      return Response.json({ error: "Faltan las anotaciones" }, { status: 400 });
    }
    if (!ownsKey(request, payload.key)) return Response.json({ error: "No autorizado" }, { status: 403 });

    const body = JSON.stringify(payload.annotations);
    if (new TextEncoder().encode(body).byteLength > MAX_ANNOTATION_SIZE) {
      return Response.json({ error: "Las anotaciones son demasiado grandes" }, { status: 413 });
    }

    await (await getBucket()).put(annotationKey(payload.key), body, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { owner: ownerFromRequest(request), sourceKey: payload.key },
    });

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron guardar las anotaciones";
    return Response.json({ error: message }, { status: 500 });
  }
}
