import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { operation } from "../lib/data/models";
const db = new PGlite();
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
async function asUser(user: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`,
  );
}
async function write(ops: any[]) {
  return db.query<{ apply_operations: string[] }>(
    "select public.apply_operations($1::jsonb)",
    [JSON.stringify(ops)],
  );
}
before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    await readFile("supabase/migrations/202609300001_core.sql", "utf8"),
  );
  await db.exec(`insert into auth.users(id) values('${a}'),('${b}');`);
  await db.exec(`create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
 grant usage on schema storage to authenticated,anon;
 grant select,insert,update,delete on storage.objects to authenticated;
 grant usage,select on sequence storage.objects_id_seq to authenticated;`);
  await db.exec(
    await readFile("supabase/migrations/202609300002_storage.sql", "utf8"),
  );
  await asUser(a);
});
after(() => db.close());
test("Atomic hierarchical import, comments, node states and two separate sessions persist", async () => {
  const ops = [
    operation("studyNodes", "root", { name: "Mi oposición", parentId: null }),
    operation("studyNodes", "article", {
      name: "Artículo X",
      parentId: "root",
    }),
    operation("studyTasks", "task1", {
      nodeId: "article",
      status: "done",
      completedAt: "2026-09-30T08:00:00Z",
      assessment: "bien",
      completionNote: "Primer repaso",
    }),
    operation("studySessions", "session1", {
      taskId: "task1",
      nodeId: "article",
      status: "done",
      assessment: "bien",
      completionNote: "Primer repaso",
    }),
    operation("studyTasks", "task2", {
      nodeId: "article",
      status: "done",
      assessment: "mal",
    }),
    operation("studySessions", "session2", {
      taskId: "task2",
      nodeId: "article",
      status: "done",
      assessment: "mal",
      completionNote: "Literalidad",
    }),
    operation("nodeStates", "article", {
      nodeId: "article",
      status: "studied",
    }),
  ];
  await write(ops);
  await write(ops);
  assert.equal((await db.query("select * from study_sessions")).rows.length, 2);
  const rows = (await db.query<any>("select * from pull_changes(0,1000)")).rows;
  assert.equal(rows.filter((r) => r.kind === "studySessions").length, 2);
  assert.equal(
    rows.find((r) => r.id === "article" && r.kind === "studyNodes").data
      .parentId,
    "root",
  );
  assert.equal(
    rows.find((r) => r.id === "session2").data.completionNote,
    "Literalidad",
  );
});
test("RLS: B cannot select, update, delete or forge A data; cross-owner parent denied", async () => {
  await asUser(b);
  assert.equal((await db.query("select * from syllabus_nodes")).rows.length, 0);
  assert.equal(
    (await db.query("select * from pull_changes(0,1000)")).rows.length,
    0,
  );
  await assert.rejects(
    () => db.query("update syllabus_nodes set data='{}' where id='root'"),
    /permission denied/,
  );
  await assert.rejects(
    () => db.query("delete from syllabus_nodes where id='root'"),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      db.query(
        `insert into syllabus_nodes(user_id,id) values('${a}','forged')`,
      ),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      write([
        operation("studyNodes", "foreign-child", {
          name: "X",
          parentId: "root",
        }),
      ]),
    /foreign key/,
  );
  await write([
    operation("studyNodes", "b-root", {
      name: "B",
      parentId: null,
      user_id: a,
    }),
  ]);
  await asUser(a);
  assert.equal(
    (await db.query("select * from syllabus_nodes where id='b-root'")).rows
      .length,
    0,
  );
});
test("Field patches from two stale sessions retain unrelated edits and journal conflicts", async () => {
  await asUser(a);
  await write([operation("studyNodes", "article", { name: "Renamed" }, 0)]);
  await write([operation("studyNodes", "article", { parentId: null }, 0)]);
  const row = (
    await db.query<any>("select data from syllabus_nodes where id='article'")
  ).rows[0];
  assert.equal(row.data.name, "Renamed");
  assert.equal(row.data.parentId, null);
  assert.ok(
    (
      await db.query<any>(
        "select * from operation_receipts where conflict=true",
      )
    ).rows.length > 0,
  );
});
test("Deleting a record prevents resurrection by a stale offline device", async () => {
  await write([operation("studyNodes", "article", {}, 0, true)]);
  await write([operation("studyNodes", "article", { name: "Stale" }, 0)]);
  assert.ok(
    (
      await db.query<any>(
        "select deleted_at from syllabus_nodes where id='article'",
      )
    ).rows[0].deleted_at,
  );
});
test("Invalid cyclic trees rollback the full batch and receipt journal", async () => {
  const ops = [
    operation("studyNodes", "c1", { name: "C1", parentId: "c2" }),
    operation("studyNodes", "c2", { name: "C2", parentId: "c1" }),
  ];
  await assert.rejects(() => write(ops), /Syllabus cycle/);
  assert.equal(
    (await db.query("select * from syllabus_nodes where id='c1'")).rows.length,
    0,
  );
});
test("Anonymous callers cannot execute RPC or read tables", async () => {
  await db.exec("reset role;set role anon;");
  await assert.rejects(
    () => db.query("select * from syllabus_nodes"),
    /permission denied/,
  );
  await assert.rejects(
    () => db.query("select apply_operations('[]')"),
    /permission denied/,
  );
  await assert.rejects(
    () => db.query("select * from pull_changes(0,1000)"),
    /permission denied/,
  );
});

test("Private Storage policies deny another user reading or writing an asset", async () => {
  await asUser(a);
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "opogc-private",
    a + "/pdf",
  ]);
  await asUser(b);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await assert.rejects(
    () =>
      db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "opogc-private",
        a + "/attack",
      ]),
    /row-level security/,
  );
  const deleted = await db.query("delete from storage.objects returning id");
  assert.equal(deleted.rows.length, 0);
  await asUser(a);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    1,
  );
});
