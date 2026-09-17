const CACHE = "opogc-shell-v9-7-20260917";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

// OpoGC v9.7 is local-first and cloud-optional.
// Normal PUT /api/state calls are persisted only in IndexedDB. The existing D1
// API is contacted only when a request explicitly includes x-opogc-force-cloud.
const LOCAL_DB = "opogc-local-sync";
const LOCAL_DB_VERSION = 1;
const LOCAL_STORE = "state";
const LOCAL_KEY = "latest";

function openLocalDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_STORE)) db.createObjectStore(LOCAL_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local"));
  });
}

async function readLocalRecord() {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readonly");
    const request = tx.objectStore(LOCAL_STORE).get(LOCAL_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("No se pudo leer el almacenamiento local"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("No se pudo leer el almacenamiento local"));
    };
  });
}

async function writeLocalRecord(record) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
    tx.objectStore(LOCAL_STORE).put(record, LOCAL_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("No se pudo guardar localmente"));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("No se pudo guardar localmente"));
    };
  });
}

function parseStatePayload(payload) {
  const parsed = JSON.parse(payload);
  if (!parsed || typeof parsed !== "object" || !parsed.state || typeof parsed.state !== "object") {
    throw new Error("Estado local no válido");
  }
  return parsed;
}

async function storePayloadLocally(payload, source = "local") {
  parseStatePayload(payload);
  const previous = await readLocalRecord();
  const record = {
    payload,
    revision: Number(previous?.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
    source,
    // Keep v9.6 fields harmlessly for backward compatibility, but v9.7 never
    // automatically flushes them to D1.
    dirty: false,
    changeCount: 0,
    lastSyncedAt: previous?.lastSyncedAt || null,
  };
  await writeLocalRecord(record);
  return record;
}

async function localStateResponse(record) {
  const parsed = parseStatePayload(record.payload);
  return Response.json({
    state: parsed.state ?? null,
    updatedAt: record.updatedAt || null,
    migrated: false,
    local: true,
    cloudAutomaticSync: false,
  });
}

async function handleStatePut(request) {
  const fallback = request.clone();
  try {
    const payload = await request.text();
    const record = await storePayloadLocally(payload, "local");
    return Response.json({
      ok: true,
      local: true,
      cloudAutomaticSync: false,
      revision: record.revision,
      updatedAt: record.updatedAt,
    }, { status: 202 });
  } catch {
    // IndexedDB should be available in the installed PWA/Safari. If it is not,
    // preserve the previous safe behaviour rather than dropping progress.
    return fetch(fallback);
  }
}

async function cacheRemoteBootstrap(response) {
  if (!response.ok) return;
  try {
    const data = await response.clone().json();
    if (!data || typeof data !== "object" || !("state" in data)) return;
    const existing = await readLocalRecord();
    if (existing?.payload) return;
    await storePayloadLocally(JSON.stringify({ state: data.state }), "cloud-bootstrap");
  } catch {
    // The network response itself must still be returned if local caching fails.
  }
}

async function handleStateGet(request) {
  let local = null;
  try { local = await readLocalRecord(); } catch { local = null; }

  // Once a device has a local copy, it is authoritative for normal study.
  if (local?.payload) {
    try { return await localStateResponse(local); } catch { /* try cloud bootstrap */ }
  }

  // First run on a device: import the existing D1 progress automatically once,
  // then continue locally from that point onward.
  try {
    const response = await fetch(request);
    if (response.ok) await cacheRemoteBootstrap(response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const forceCloud = request.headers.get("x-opogc-force-cloud") === "1";

  if (url.pathname === "/api/state" && forceCloud) {
    // Explicit backup requested by the user from the Datos panel.
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname === "/api/state" && request.method === "PUT") {
    event.respondWith(handleStatePut(request));
    return;
  }

  if (url.pathname === "/api/state" && request.method === "GET") {
    event.respondWith(handleStateGet(request));
    return;
  }

  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === "navigate" || url.pathname.startsWith("/_next/static/"))) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? caches.match("/") : Response.error())),
  );
});
