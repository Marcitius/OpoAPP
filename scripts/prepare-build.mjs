// Remove only fingerprinted pre-Supabase routes from Next's discovery. Original
// bytes remain in legacy-backup and never enter the exported out directory.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
const known = JSON.parse(
  fs.readFileSync(
    new URL("./legacy-build-files.json", import.meta.url),
    "utf8",
  ),
);
export function legacyDigest(bytes) {
  const normalized =
    bytes.toString("utf8").replaceAll("\r\n", "\n").trimEnd() + "\n";
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
export function prepareBuild(root = process.cwd()) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  if (
    pkg.name !== "opogc" ||
    !fs.existsSync(path.join(root, "lib/sync/engine.ts"))
  )
    throw new Error(
      "Ejecuta la preparación desde la raíz del proyecto OpoGC con Supabase.",
    );
  const plan = [];
  for (const [relative, expected] of Object.entries(known.sha256)) {
    const original = path.join(root, relative);
    if (!fs.existsSync(original)) continue;
    if (
      !fs.lstatSync(original).isFile() ||
      legacyDigest(fs.readFileSync(original)) !== expected
    )
      throw new Error(
        `No se ha apartado ${relative}: difiere de la versión antigua comprobada. Revisa ese archivo antes de compilar.`,
      );
    const backup = path.join(root, "legacy-backup", relative + ".disabled");
    if (fs.existsSync(backup))
      throw new Error(`Ya existe ${backup}. No se sobrescribe ninguna copia.`);
    plan.push({ relative, original, backup });
  }
  // Validate the full list before moving anything. No backend/data calls.
  for (const item of plan) {
    fs.mkdirSync(path.dirname(item.backup), { recursive: true });
    fs.renameSync(item.original, item.backup);
    console.log(
      `Archivo antiguo apartado del build: ${item.relative} (copia conservada)`,
    );
  }
  return plan.map((item) => item.relative);
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    prepareBuild();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
