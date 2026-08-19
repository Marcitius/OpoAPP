import { ownerFromRequest } from "@/db";
import { getStorageStatus } from "@/db/storage";

export async function GET(request: Request) {
  try {
    const owner = ownerFromRequest(request);
    return Response.json(await getStorageStatus(owner));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo comprobar el almacenamiento";
    return Response.json({ error: message }, { status: 500 });
  }
}
