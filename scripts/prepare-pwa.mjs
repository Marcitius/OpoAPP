import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const built = process.argv.includes("--built");
for (const name of ["pdf.min.mjs", "pdf.worker.min.mjs"])
  fs.copyFileSync("node_modules/pdfjs-dist/build/" + name, "public/" + name);
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
const source = walk("app").concat(walk("components"), walk("lib"));
let revision = crypto
  .createHash("sha256")
  .update(source.map((x) => fs.readFileSync(x)).join(""))
  .digest("hex")
  .slice(0, 12);
const shell = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon.png",
  "/icon.svg",
  "/pdf.min.mjs",
  "/pdf.worker.min.mjs",
];
if (built)
  shell.push(
    ...walk("out/_next/static").map(
      (x) => "/" + x.slice(4).replaceAll("\\", "/"),
    ),
  );
if (built)
  revision = crypto
    .createHash("sha256")
    .update(revision + JSON.stringify(shell))
    .digest("hex")
    .slice(0, 12);
const worker = `const CACHE='opogc-v10-${revision}';
const SHELL=${JSON.stringify(shell)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));});
self.addEventListener('message',e=>{if(e.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('opogc-v10-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;
 // Cache only public application assets. Auth and personal data never pass through this cache.
 if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.open(CACHE).then(c=>c.match('/'))));return;}
 if(SHELL.includes(u.pathname)){e.respondWith(caches.open(CACHE).then(async c=>(await c.match(r))||fetch(r)));}
});
`;
fs.writeFileSync("public/sw.js", worker);
if (built) fs.writeFileSync("out/sw.js", worker);
// The same manifest is served on all hosts, including static Cloudflare Pages.
const manifest = {
  id: "/",
  name: "OpoGC · Organización de estudio",
  short_name: "OpoGC",
  description:
    "Organiza, estudia y repasa tu oposición en todos tus dispositivos",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#F5F3ED",
  theme_color: "#285943",
  orientation: "any",
  icons: [
    {
      src: "/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};
fs.writeFileSync(
  "public/manifest.webmanifest",
  JSON.stringify(manifest, null, 2),
);
fs.writeFileSync(
  "public/version.json",
  JSON.stringify(
    { version: "10.0.0", revision, architecture: "supabase-record-sync" },
    null,
    2,
  ),
);

if (built) fs.copyFileSync("public/version.json", "out/version.json");
