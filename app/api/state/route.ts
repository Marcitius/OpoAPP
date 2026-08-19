import { getD1, ownerFromRequest } from "@/db";

const CREATE_STATE_TABLE = `CREATE TABLE IF NOT EXISTS app_state (
  owner TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

async function ensureSchema() {
  const db = await getD1();
  await db.prepare(CREATE_STATE_TABLE).run();
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const owner = ownerFromRequest(request);
    const row = await (await getD1())
      .prepare("SELECT data, updated_at AS updatedAt FROM app_state WHERE owner = ?")
      .bind(owner)
      .first<{ data: string; updatedAt: string }>();

    if (!row) return Response.json({ state: null, updatedAt: null });
    return Response.json({ state: JSON.parse(row.data), updatedAt: row.updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar el progreso";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureSchema();
    const owner = ownerFromRequest(request);
    const payload = (await request.json()) as { state?: unknown };
    if (!payload.state || typeof payload.state !== "object") {
      return Response.json({ error: "Estado no válido" }, { status: 400 });
    }

    const data = JSON.stringify(payload.state);
    if (data.length > 3_000_000) {
      return Response.json({ error: "El estado supera el tamaño permitido" }, { status: 413 });
    }

    const updatedAt = new Date().toISOString();
    await (await getD1())
      .prepare(
        `INSERT INTO app_state (owner, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(owner) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .bind(owner, data, updatedAt)
      .run();

    return Response.json({ ok: true, updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el progreso";
    return Response.json({ error: message }, { status: 500 });
  }
}
