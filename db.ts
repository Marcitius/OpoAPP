async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env;
}

export async function getD1() {
  return (await runtimeEnv()).DB;
}

export async function getBucket() {
  return (await runtimeEnv()).BUCKET;
}

export function ownerFromRequest(request: Request) {
  return (
    request.headers.get("oai-authenticated-user-email") ??
    request.headers.get("cf-access-authenticated-user-email") ??
    "owner"
  ).toLowerCase();
}
