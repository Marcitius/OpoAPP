/** Tests a REAL configured Supabase. No service role and no emulated auth. Use disposable users. */
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { operation } from "../lib/data/models";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || url.includes("YOUR_PROJECT"))
  throw new Error("Configura .env.local con un Supabase real.");
const make = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const a = make(),
  a2 = make(),
  b = make();
async function login(c: ReturnType<typeof make>, suffix: "A" | "B") {
  const email = process.env["TEST_EMAIL_" + suffix],
    password = process.env["TEST_PASSWORD_" + suffix];
  if (!email || !password)
    throw new Error(
      `Configura TEST_EMAIL_${suffix} y TEST_PASSWORD_${suffix} con una cuenta desechable.`,
    );
  const registration = await c.auth.signUp({ email, password });
  if (registration.error && !registration.error.message.includes("already"))
    throw registration.error;
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error)
    throw new Error(
      `Confirma primero el correo de ${suffix}. ${error.message}`,
    );
}
async function rpc(c: ReturnType<typeof make>, name: string, args: any) {
  const { data, error } = await c.rpc(name, args);
  if (error) throw error;
  return data;
}
await login(a, "A");
await login(b, "B");
const email = process.env.TEST_EMAIL_A!,
  password = process.env.TEST_PASSWORD_A!;
assert.equal(
  (await a2.auth.signInWithPassword({ email, password })).error,
  null,
);
const prefix = "test-" + crypto.randomUUID(),
  node = prefix + "-node",
  child = prefix + "-child",
  task1 = prefix + "-task1",
  task2 = prefix + "-task2";
const ops = [
  operation("studyNodes", node, { name: "Prueba integración", parentId: null }),
  operation("studyNodes", child, { name: "Artículo X", parentId: node }),
  operation("studyTasks", task1, {
    nodeId: child,
    status: "done",
    assessment: "bien",
    completedAt: new Date().toISOString(),
    completionNote: "Comentario 1",
  }),
  operation("studySessions", prefix + "-s1", {
    taskId: task1,
    nodeId: child,
    status: "done",
    assessment: "bien",
    completionNote: "Comentario 1",
  }),
  operation("studyTasks", task2, {
    nodeId: child,
    status: "done",
    assessment: "mal",
    completedAt: new Date().toISOString(),
  }),
  operation("studySessions", prefix + "-s2", {
    taskId: task2,
    nodeId: child,
    status: "done",
    assessment: "mal",
    completionNote: "Comentario 2",
  }),
];
try {
  await rpc(a, "apply_operations", { operations: ops });
  await rpc(a, "apply_operations", { operations: ops });
  await a.auth.signOut();
  assert.equal(
    (await a.auth.signInWithPassword({ email, password })).error,
    null,
  );
  const load = async (c: ReturnType<typeof make>) => {
    const all = [];
    let cursor = 0;
    for (;;) {
      const rows = await rpc(c, "pull_changes", {
        after_revision: cursor,
        page_size: 1000,
      });
      all.push(...rows);
      if (rows.length < 1000) return all;
      cursor = rows.at(-1).revision;
    }
  };
  const stored = await load(a);
  assert.equal(
    stored.filter(
      (r: any) => r.kind === "studySessions" && r.id.startsWith(prefix),
    ).length,
    2,
  );
  const other = await load(a2);
  assert.equal(
    other.find((r: any) => r.id === child && r.kind === "studyNodes").data
      .parentId,
    node,
  );
  const foreign = await b.from("syllabus_nodes").select("*").eq("id", child);
  assert.equal(foreign.error, null);
  assert.equal(foreign.data?.length, 0);
  const denied = await b
    .from("syllabus_nodes")
    .update({ data: { name: "attack" } })
    .eq("id", child);
  assert.ok(denied.error);
  const observed = await new Promise<boolean>(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      void a2.removeAllChannels();
      resolve(false);
    }, 15000);
    a2.channel(prefix)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_heads",
          filter: `user_id=eq.${(await a.auth.getUser()).data.user!.id}`,
        },
        () => {
          clearTimeout(timeout);
          resolve(true);
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await rpc(a, "apply_operations", {
              operations: [
                operation("studyNodes", child, {
                  name: "Cambio desde sesión A",
                }),
              ],
            });
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        }
      });
  });
  assert.ok(observed, "No se recibió Realtime en la segunda sesión.");
  console.log(
    "PASS: Auth real, cierre/reinicio de sesión, persistencia, dos sesiones, RLS, jerarquía, historial, idempotencia y Realtime.",
  );
} finally {
  await rpc(a, "apply_operations", {
    operations: ops.map((op) => operation(op.kind, op.id, {}, 0, true)),
  });
  await Promise.all([a.auth.signOut(), a2.auth.signOut(), b.auth.signOut()]);
  await a2.removeAllChannels();
}
