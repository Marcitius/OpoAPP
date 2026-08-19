import { ownerFromRequest } from "@/db";
import { isAppState, loadState, saveState } from "@/db/storage";

export async function GET(request: Request) {
  try {
    const owner = ownerFromRequest(request);
    const result = await loadState(owner);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar el progreso";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const owner = ownerFromRequest(request);
    const payload = (await request.json()) as { state?: unknown };

    if (!isAppState(payload.state)) {
      return Response.json({ error: "Estado no válido" }, { status: 400 });
    }

    const result = await saveState(owner, payload.state);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el progreso";
    return Response.json({ error: message }, { status: 500 });
  }
}
