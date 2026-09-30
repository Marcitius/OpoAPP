from pathlib import Path
kinds={'competitions':'competitions','syllabi':'syllabi','folders':'folders','cards':'cards','reviews':'card_reviews','psychTests':'psych_tests','attempts':'psych_attempts','studyNodes':'syllabus_nodes','studyTasks':'study_tasks','studySessions':'study_sessions','nodeStates':'node_states','annotations':'annotations','settings':'user_settings'}
sql='''-- OpoGC v10. Apply once, in order, in Supabase SQL Editor or supabase db push.
-- All record IDs are text so legacy IDs are preserved. Ownership is always auth.uid().
begin;
create sequence public.opogc_revision;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_owner on public.profiles to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select,update on public.profiles to authenticated;
create function public.handle_new_opogc_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(user_id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''));return new;end;$$;
revoke all on function public.handle_new_opogc_user() from public;
create trigger on_opogc_signup after insert on auth.users for each row execute function public.handle_new_opogc_user();
insert into public.profiles(user_id) select id from auth.users on conflict do nothing;
'''
for kind,t in kinds.items():
 sql+=f'''create table public.{t} (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{{}}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index {t}_changes on public.{t}(user_id,revision);
alter table public.{t} enable row level security;
create policy {t}_owner on public.{t} to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.{t} to authenticated;
revoke insert,update,delete on public.{t} from anon,authenticated;
'''
relations=[('syllabi','competition_id',"coalesce(data->>'competitionId','default')",'competitions'),('folders','parent_id',"nullif(data->>'parentId','')",'folders'),('cards','folder_id',"data->>'folderId'",'folders'),('card_reviews','card_id',"data->>'cardId'",'cards'),('psych_attempts','test_id',"data->>'testId'",'psych_tests'),('syllabus_nodes','parent_id',"nullif(data->>'parentId','')",'syllabus_nodes'),('syllabus_nodes','syllabus_id',"coalesce(data->>'syllabusId','default')",'syllabi'),('study_tasks','node_id',"data->>'nodeId'",'syllabus_nodes'),('study_sessions','node_id',"data->>'nodeId'",'syllabus_nodes'),('study_sessions','task_id',"data->>'taskId'",'study_tasks'),('node_states','node_id',"data->>'nodeId'",'syllabus_nodes')]
for t,col,expr,parent in relations:
 sql+=f"alter table public.{t} add column {col} text generated always as ({expr}) stored;\nalter table public.{t} add constraint {t}_{col}_fk foreign key(user_id,{col}) references public.{parent}(user_id,id) deferrable initially deferred;\ncreate index {t}_{col}_idx on public.{t}(user_id,{col});\n"
sql+='''alter table public.card_reviews add constraint review_rating check(data->>'rating' in ('again','hard','good','easy'));
alter table public.study_tasks add constraint task_status check(data->>'status' in ('pending','done'));
alter table public.study_sessions add constraint session_assessment check(data->>'assessment' in ('bien','regular','mal') or data->>'assessment' is null);
create table public.sync_heads(user_id uuid primary key references auth.users(id) on delete cascade, revision bigint not null, updated_at timestamptz not null default now());
alter table public.sync_heads enable row level security;
create policy sync_heads_owner on public.sync_heads for select to authenticated using(user_id=(select auth.uid()));
grant select on public.sync_heads to authenticated;
create table public.operation_receipts (
 user_id uuid not null references auth.users(id) on delete cascade, op_id uuid not null,
 kind text not null, record_id text not null, patch jsonb not null, deleted boolean not null,
 base_revision bigint not null, applied_revision bigint not null, conflict boolean not null default false,
 created_at timestamptz not null default now(), primary key(user_id,op_id)
);
alter table public.operation_receipts enable row level security;
create policy receipts_owner on public.operation_receipts for select to authenticated using(user_id=(select auth.uid()));
grant select on public.operation_receipts to authenticated;
-- Keeps each conflicting edit for auditing/recovery. Client clocks are not used for ordering.
create function public.apply_operations(operations jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); op jsonb; k text; tbl text; rid text; oid uuid; patch jsonb;
 prior jsonb; prior_rev bigint; prior_deleted timestamptz; rev bigint; is_del boolean;
 acknowledgements jsonb:='[]'::jsonb; max_rev bigint:=0;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501';end if;
 if jsonb_typeof(operations)<>'array' or jsonb_array_length(operations)>50000 or octet_length(operations::text)>25000000 then raise exception 'Invalid operation batch or batch too large';end if;
 -- Serialize transactions for this account: revision cursors cannot skip an uncommitted write.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,0));
 -- A generic workspace exists independently of the current opposition.
 insert into public.competitions(user_id,id,data) values(u,'default','{"id":"default","name":"Mi oposición"}') on conflict do nothing;
 insert into public.syllabi(user_id,id,data) values(u,'default','{"id":"default","name":"Mi temario","competitionId":"default"}') on conflict do nothing;
 for op in select value from jsonb_array_elements(operations) loop
  k:=op->>'kind'; rid:=op->>'id'; oid:=(op->>'op_id')::uuid;
  if exists(select 1 from public.operation_receipts where user_id=u and op_id=oid) then acknowledgements:=acknowledgements||to_jsonb(oid::text);continue;end if;
  tbl:=case k
'''
for k,t in kinds.items():sql+=f" when '{k}' then '{t}'\n"
sql+=''' else null end;
  if tbl is null or rid is null or length(rid) not between 1 and 512 then raise exception 'Invalid collection or ID';end if;
  patch:=coalesce(op->'patch','{}'::jsonb)-'user_id'-'revision'-'deleted_at'-'created_at'-'updated_at';
  if jsonb_typeof(patch)<>'object' then raise exception 'Patch must be an object';end if;
  patch:=patch||jsonb_build_object('id',rid);
  is_del:=coalesce((op->>'deleted')::boolean,false);
  execute format('select data,revision,deleted_at from public.%I where user_id=$1 and id=$2',tbl) into prior,prior_rev,prior_deleted using u,rid;
  -- A stale device cannot resurrect a deleted record. Events are append-only by ID.
  if prior_deleted is not null or (k='reviews' and prior is not null and not is_del) then
   rev:=prior_rev;
  else
   rev:=nextval('public.opogc_revision');
   execute format('insert into public.%I(user_id,id,data,revision,deleted_at) values($1,$2,$3,$4,$5)
     on conflict(user_id,id) do update set data=public.%I.data||excluded.data,revision=excluded.revision,deleted_at=excluded.deleted_at,updated_at=clock_timestamp()',tbl,tbl)
     using u,rid,coalesce(prior,'{}'::jsonb)||patch,rev,case when is_del then clock_timestamp() else null end;
  end if;
  insert into public.operation_receipts(user_id,op_id,kind,record_id,patch,deleted,base_revision,applied_revision,conflict)
   values(u,oid,k,rid,patch,is_del,coalesce((op->>'base_revision')::bigint,0),rev,prior_rev is not null and prior_rev<>coalesce((op->>'base_revision')::bigint,0));
  max_rev:=greatest(max_rev,rev);acknowledgements:=acknowledgements||to_jsonb(oid::text);
 end loop;
 -- Validate both trees after the complete atomic batch, without a fixed depth limit.
 if exists(with recursive chain as (
  select id,parent_id,array[id] path,false cycle from public.syllabus_nodes where user_id=u and deleted_at is null
  union all select c.id,n.parent_id,c.path||n.id,n.id=any(c.path) from chain c join public.syllabus_nodes n on n.user_id=u and n.id=c.parent_id where not c.cycle
 ) select 1 from chain where cycle) then raise exception 'Syllabus cycle';end if;
 if exists(with recursive chain as (
  select id,parent_id,array[id] path,false cycle from public.folders where user_id=u and deleted_at is null
  union all select c.id,n.parent_id,c.path||n.id,n.id=any(c.path) from chain c join public.folders n on n.user_id=u and n.id=c.parent_id where not c.cycle
 ) select 1 from chain where cycle) then raise exception 'Folder cycle';end if;
 if max_rev>0 then insert into public.sync_heads(user_id,revision) values(u,max_rev) on conflict(user_id) do update set revision=greatest(public.sync_heads.revision,excluded.revision),updated_at=clock_timestamp();end if;
 return acknowledgements;
end;$$;
revoke all on function public.apply_operations(jsonb) from public,anon;
grant execute on function public.apply_operations(jsonb) to authenticated;
create function public.pull_changes(after_revision bigint default 0,page_size integer default 1000)
returns table(kind text,id text,data jsonb,revision bigint,deleted boolean,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select * from (
'''
sql+='\n union all\n'.join(f" select '{k}'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.{t} where user_id=auth.uid() and revision>after_revision" for k,t in kinds.items())
sql+='''
 ) records order by revision limit least(greatest(page_size,1),1000);
$$;
revoke all on function public.pull_changes(bigint,integer) from public,anon;
grant execute on function public.pull_changes(bigint,integer) to authenticated;
-- Only a tiny per-user invalidation row is published, not every payload.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.sync_heads;
 end if;
end $$;
commit;
'''
Path('opogc/supabase/migrations/202609300001_core.sql').write_text(sql)
