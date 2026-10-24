import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prepareBuild } from "../scripts/prepare-build.mjs";
const relative = "app/api/state/route.ts";
const legacy = fs.readFileSync(
  new URL("./fixtures/legacy-state-route.txt", import.meta.url),
);
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opogc-build-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "opogc" }),
  );
  fs.mkdirSync(path.join(dir, "lib/sync"), { recursive: true });
  fs.writeFileSync(path.join(dir, "lib/sync/engine.ts"), "// protected sync");
  fs.mkdirSync(path.join(dir, "app/api/state"), { recursive: true });
  return dir;
}
test("known obsolete route is backed up byte-for-byte; sync and unrelated files remain unchanged", (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, relative), legacy);
  fs.writeFileSync(
    path.join(dir, "app/page.tsx"),
    "export default function Page() {} ",
  );
  assert.deepEqual(prepareBuild(dir), [relative]);
  assert.equal(fs.existsSync(path.join(dir, relative)), false);
  assert.deepEqual(
    fs.readFileSync(path.join(dir, "legacy-backup", relative + ".disabled")),
    legacy,
  );
  assert.equal(
    fs.readFileSync(path.join(dir, "lib/sync/engine.ts"), "utf8"),
    "// protected sync",
  );
  assert.equal(
    fs.readFileSync(path.join(dir, "app/page.tsx"), "utf8"),
    "export default function Page() {} ",
  );
});
test("clean and already prepared projects are idempotent", (t) => {
  const dir = fixture(t);
  assert.deepEqual(prepareBuild(dir), []);
  fs.writeFileSync(path.join(dir, relative), legacy);
  prepareBuild(dir);
  assert.deepEqual(prepareBuild(dir), []);
});
test("an edited route is rejected without moving it or changing the sync engine", (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, relative), "// custom route");
  assert.throws(() => prepareBuild(dir), /difiere/);
  assert.equal(
    fs.readFileSync(path.join(dir, relative), "utf8"),
    "// custom route",
  );
  assert.equal(fs.existsSync(path.join(dir, "legacy-backup")), false);
});
test("existing backups are not overwritten", (t) => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, relative), legacy);
  const backup = path.join(dir, "legacy-backup", relative + ".disabled");
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup, "old backup");
  assert.throws(() => prepareBuild(dir), /No se sobrescribe/);
  assert.equal(fs.readFileSync(backup, "utf8"), "old backup");
  assert.deepEqual(fs.readFileSync(path.join(dir, relative)), legacy);
});
