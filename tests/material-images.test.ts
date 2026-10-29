import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { sanitizeMaterial, clipboardMaterial } from "../lib/material/format";
import {
  imageKey,
  materialImage,
  materialImageAttachments,
  remapMaterialImages,
  validateMaterialImage,
} from "../lib/material/images";
import { exportMaterialImages } from "../lib/material/exportImages";
import { emptyState } from "../lib/data/models";
import {
  differences,
  project,
  applyLocal,
  mergeRemote,
  flatten,
} from "../lib/data/projection";
import { readAccount, transact } from "../lib/data/local";
const id = "bb073725-ccfe-4085-81f0-a97218f7ec9c";
const asset = {
  id,
  key: "image-user-a/" + id,
  name: "Esquema.png",
  type: "image/png",
  size: 68,
  url: "supabase://image-user-a/" + id,
};
const record = { version: 1, attachment: asset };
const imageHtml = `<p>Texto</p><img data-material-image="${id}" alt="Esquema" data-width="50" data-align="right"><p>Después</p>`;
test("Only registered-image references survive sanitizing; external/data sources and handlers cannot execute", () => {
  const html = sanitizeMaterial(
    imageHtml +
      `<img src="https://tracker.invalid"><img src="data:image/svg+xml,unsafe"><img data-material-image="bad" onerror="alert(1)">`,
  );
  assert.equal((html.match(/<img/g) || []).length, 1);
  assert.ok(!/onerror|https:|data:image/i.test(html));
  assert.match(html, /data-width="50"/);
  assert.match(
    clipboardMaterial(`<img data-material-image="${id}">`, ""),
    /data-material-image/,
  );
  assert.ok(
    !sanitizeMaterial(
      `<img data-material-image="${id}" src="javascript:alert(1)" onload="x()">`,
    ).includes("javascript"),
  );
});
test("Metadata validates format, does not alter card assets and remaps portable storage while keeping logical image IDs", () => {
  const settings = { other: { keep: true }, [imageKey(id)]: record };
  assert.deepEqual(materialImage(settings, id), asset);
  assert.equal(materialImage(settings, "bad"), null);
  assert.deepEqual(materialImageAttachments(settings), [asset]);
  const restored = {
    ...asset,
    id: "import-" + id,
    key: "image-user-b/import-" + id,
    url: "supabase://image-user-b/import-" + id,
  };
  const next = remapMaterialImages(settings, new Map([[asset.key, restored]]));
  assert.equal(next.other, settings.other);
  assert.equal(materialImage(next, id)!.key, restored.key);
  assert.equal(materialImage(settings, id)!.key, asset.key);
  assert.throws(() =>
    validateMaterialImage({ type: "image/svg+xml", size: 1 }),
  );
  assert.throws(() =>
    validateMaterialImage({ type: "image/png", size: 51 * 1024 * 1024 }),
  );
  validateMaterialImage({ type: "image/jpeg", size: 1024 });
});
test("Image references survive local outbox, reload, remote projection and account isolation without embedding bytes", async () => {
  const s = emptyState();
  s.settings[imageKey(id)] = record;
  s.settings["studyMaterialContent:doc"] = { version: 1, html: imageHtml };
  await transact("material-image-a", (a) =>
    applyLocal(a, differences(emptyState(), s, a)),
  );
  const local = project((await readAccount("material-image-a")).rows);
  assert.equal(materialImage(local.settings, id)!.key, asset.key);
  await transact("material-image-b", (a) =>
    mergeRemote(
      a,
      Object.values(flatten(local)).map((r) => ({
        ...r,
        revision: 1,
        deleted: false,
      })),
      1,
    ),
  );
  const remote = project((await readAccount("material-image-b")).rows);
  assert.equal(remote.settings["studyMaterialContent:doc"].html, imageHtml);
  assert.equal(
    materialImage(
      project((await readAccount("another-account")).rows).settings,
      id,
    ),
    null,
  );
  assert.ok(
    !JSON.stringify((await readAccount("material-image-a")).queue).includes(
      "base64",
    ),
  );
});
// Entire authenticated file transport is mocked: no network or real credentials.
// The production upload/cache/backup/restore implementations are exercised below.
test("Actual private upload, offline cache, portable backup and cross-account restore include Material images", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://images-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true, userAgent: "OpoGC-test" },
  });
  const previousFetch = globalThis.fetch;
  let user = "image-user-a",
    uploads = 0;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/auth/v1/logout"))
      return new Response(null, { status: 204 });
    if (url.includes("/auth/v1/user"))
      return Response.json({
        id: user,
        aud: "authenticated",
        role: "authenticated",
        email: user + "@example.test",
      });
    if (url.includes("/storage/v1/object/")) {
      const method =
        input instanceof Request ? input.method : init?.method || "GET";
      if (method === "GET")
        return new Response(png, { headers: { "Content-Type": "image/png" } });
      uploads++;
      return Response.json({
        Key: "opogc-private/file",
        Id: crypto.randomUUID(),
      });
    }
    throw Error("Unexpected network request in file test: " + url);
  };
  class TestReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then(
        (bytes) => {
          this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
          this.onload?.();
        },
        () => this.onerror?.(),
      );
    }
  }
  Object.defineProperty(globalThis, "FileReader", {
    configurable: true,
    value: TestReader,
  });
  const { supabase } = await import("../lib/auth/client");
  const {
    uploadAttachment,
    attachmentBlob,
    preparePortableBackup,
    restorePortableAssets,
  } = await import("../lib/data/files");
  const client = supabase();
  const sign = async () => {
    const token =
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ) +
      "." +
      Buffer.from(JSON.stringify({ exp: 9999999999, sub: user })).toString(
        "base64url",
      ) +
      ".test";
    const { error } = await client.auth.setSession({
      access_token: token,
      refresh_token: "test-refresh",
    });
    if (error) throw error;
  };
  try {
    await sign();
    await client.auth.stopAutoRefresh();
    const uploaded = await uploadAttachment(
      new File([png], "Esquema.png", { type: "image/png" }),
    );
    assert.ok(uploaded.key.startsWith(user + "/"));
    assert.equal(uploads, 1);
    const remoteOnly = {
      ...uploaded,
      key: user + "/remote-only",
      url: "supabase://" + user + "/remote-only",
    };
    assert.equal((await attachmentBlob(remoteOnly)).size, png.length);
    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    assert.equal((await attachmentBlob(uploaded)).size, png.length);
    const source = emptyState();
    source.settings[imageKey(id)] = { version: 1, attachment: uploaded };
    source.settings["studyMaterialContent:doc"] = {
      version: 1,
      html: imageHtml,
    };
    const backup = await preparePortableBackup({
      user,
      state: source,
      flush: async () => true,
    } as any);
    assert.equal(backup.assets[uploaded.key].base64, png.toString("base64"));
    assert.equal(
      backup.state.settings["studyMaterialContent:doc"].html,
      imageHtml,
    );
    const exported = await exportMaterialImages(
      imageHtml,
      source.settings,
      attachmentBlob,
    );
    assert.match(exported, /src="data:image\/png;base64,/);
    assert.ok(!exported.includes("supabase://"));
    user = "image-user-b";
    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    await sign();
    await client.auth.stopAutoRefresh();
    await assert.rejects(() => attachmentBlob(uploaded), /otra cuenta/);
    const restored = await restorePortableAssets(backup.state, backup.assets);
    const copied = materialImage(restored.settings, id)!;
    assert.ok(copied.key.startsWith(user + "/"));
    assert.equal(uploads, 2);
    assert.equal(restored.settings["studyMaterialContent:doc"].html, imageHtml);
    assert.equal((await attachmentBlob(copied)).size, png.length);
  } finally {
    await client.auth.signOut({ scope: "local" });
    await client.auth.stopAutoRefresh();
    (client.auth as any).broadcastChannel?.close();
    globalThis.fetch = previousFetch;
  }
});
