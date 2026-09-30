-- OpoGC v10. Apply once, in order, in Supabase SQL Editor or supabase db push.
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
create table public.competitions (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index competitions_changes on public.competitions(user_id,revision);
alter table public.competitions enable row level security;
create policy competitions_owner on public.competitions to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.competitions to authenticated;
revoke insert,update,delete on public.competitions from anon,authenticated;
create table public.syllabi (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index syllabi_changes on public.syllabi(user_id,revision);
alter table public.syllabi enable row level security;
create policy syllabi_owner on public.syllabi to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.syllabi to authenticated;
revoke insert,update,delete on public.syllabi from anon,authenticated;
create table public.folders (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index folders_changes on public.folders(user_id,revision);
alter table public.folders enable row level security;
create policy folders_owner on public.folders to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.folders to authenticated;
revoke insert,update,delete on public.folders from anon,authenticated;
create table public.cards (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index cards_changes on public.cards(user_id,revision);
alter table public.cards enable row level security;
create policy cards_owner on public.cards to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.cards to authenticated;
revoke insert,update,delete on public.cards from anon,authenticated;
create table public.card_reviews (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index card_reviews_changes on public.card_reviews(user_id,revision);
alter table public.card_reviews enable row level security;
create policy card_reviews_owner on public.card_reviews to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.card_reviews to authenticated;
revoke insert,update,delete on public.card_reviews from anon,authenticated;
create table public.psych_tests (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index psych_tests_changes on public.psych_tests(user_id,revision);
alter table public.psych_tests enable row level security;
create policy psych_tests_owner on public.psych_tests to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.psych_tests to authenticated;
revoke insert,update,delete on public.psych_tests from anon,authenticated;
create table public.psych_attempts (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index psych_attempts_changes on public.psych_attempts(user_id,revision);
alter table public.psych_attempts enable row level security;
create policy psych_attempts_owner on public.psych_attempts to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.psych_attempts to authenticated;
revoke insert,update,delete on public.psych_attempts from anon,authenticated;
create table public.syllabus_nodes (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index syllabus_nodes_changes on public.syllabus_nodes(user_id,revision);
alter table public.syllabus_nodes enable row level security;
create policy syllabus_nodes_owner on public.syllabus_nodes to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.syllabus_nodes to authenticated;
revoke insert,update,delete on public.syllabus_nodes from anon,authenticated;
create table public.study_tasks (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index study_tasks_changes on public.study_tasks(user_id,revision);
alter table public.study_tasks enable row level security;
create policy study_tasks_owner on public.study_tasks to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.study_tasks to authenticated;
revoke insert,update,delete on public.study_tasks from anon,authenticated;
create table public.study_sessions (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index study_sessions_changes on public.study_sessions(user_id,revision);
alter table public.study_sessions enable row level security;
create policy study_sessions_owner on public.study_sessions to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.study_sessions to authenticated;
revoke insert,update,delete on public.study_sessions from anon,authenticated;
create table public.node_states (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index node_states_changes on public.node_states(user_id,revision);
alter table public.node_states enable row level security;
create policy node_states_owner on public.node_states to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.node_states to authenticated;
revoke insert,update,delete on public.node_states from anon,authenticated;
create table public.annotations (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index annotations_changes on public.annotations(user_id,revision);
alter table public.annotations enable row level security;
create policy annotations_owner on public.annotations to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.annotations to authenticated;
revoke insert,update,delete on public.annotations from anon,authenticated;
create table public.user_settings (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 512),
 data jsonb not null default '{}' check (jsonb_typeof(data)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, revision bigint not null default nextval('public.opogc_revision'),
 primary key(user_id,id)
);
create index user_settings_changes on public.user_settings(user_id,revision);
alter table public.user_settings enable row level security;
create policy user_settings_owner on public.user_settings to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- Clients read under RLS, and write only via the authenticated RPC below.
grant select on public.user_settings to authenticated;
revoke insert,update,delete on public.user_settings from anon,authenticated;
alter table public.syllabi add column competition_id text generated always as (coalesce(data->>'competitionId','default')) stored;
alter table public.syllabi add constraint syllabi_competition_id_fk foreign key(user_id,competition_id) references public.competitions(user_id,id) deferrable initially deferred;
create index syllabi_competition_id_idx on public.syllabi(user_id,competition_id);
alter table public.folders add column parent_id text generated always as (nullif(data->>'parentId','')) stored;
alter table public.folders add constraint folders_parent_id_fk foreign key(user_id,parent_id) references public.folders(user_id,id) deferrable initially deferred;
create index folders_parent_id_idx on public.folders(user_id,parent_id);
alter table public.cards add column folder_id text generated always as (data->>'folderId') stored;
alter table public.cards add constraint cards_folder_id_fk foreign key(user_id,folder_id) references public.folders(user_id,id) deferrable initially deferred;
create index cards_folder_id_idx on public.cards(user_id,folder_id);
alter table public.card_reviews add column card_id text generated always as (data->>'cardId') stored;
alter table public.card_reviews add constraint card_reviews_card_id_fk foreign key(user_id,card_id) references public.cards(user_id,id) deferrable initially deferred;
create index card_reviews_card_id_idx on public.card_reviews(user_id,card_id);
alter table public.psych_attempts add column test_id text generated always as (data->>'testId') stored;
alter table public.psych_attempts add constraint psych_attempts_test_id_fk foreign key(user_id,test_id) references public.psych_tests(user_id,id) deferrable initially deferred;
create index psych_attempts_test_id_idx on public.psych_attempts(user_id,test_id);
alter table public.syllabus_nodes add column parent_id text generated always as (nullif(data->>'parentId','')) stored;
alter table public.syllabus_nodes add constraint syllabus_nodes_parent_id_fk foreign key(user_id,parent_id) references public.syllabus_nodes(user_id,id) deferrable initially deferred;
create index syllabus_nodes_parent_id_idx on public.syllabus_nodes(user_id,parent_id);
alter table public.syllabus_nodes add column syllabus_id text generated always as (coalesce(data->>'syllabusId','default')) stored;
alter table public.syllabus_nodes add constraint syllabus_nodes_syllabus_id_fk foreign key(user_id,syllabus_id) references public.syllabi(user_id,id) deferrable initially deferred;
create index syllabus_nodes_syllabus_id_idx on public.syllabus_nodes(user_id,syllabus_id);
alter table public.study_tasks add column node_id text generated always as (data->>'nodeId') stored;
alter table public.study_tasks add constraint study_tasks_node_id_fk foreign key(user_id,node_id) references public.syllabus_nodes(user_id,id) deferrable initially deferred;
create index study_tasks_node_id_idx on public.study_tasks(user_id,node_id);
alter table public.study_sessions add column node_id text generated always as (data->>'nodeId') stored;
alter table public.study_sessions add constraint study_sessions_node_id_fk foreign key(user_id,node_id) references public.syllabus_nodes(user_id,id) deferrable initially deferred;
create index study_sessions_node_id_idx on public.study_sessions(user_id,node_id);
alter table public.study_sessions add column task_id text generated always as (data->>'taskId') stored;
alter table public.study_sessions add constraint study_sessions_task_id_fk foreign key(user_id,task_id) references public.study_tasks(user_id,id) deferrable initially deferred;
create index study_sessions_task_id_idx on public.study_sessions(user_id,task_id);
alter table public.node_states add column node_id text generated always as (data->>'nodeId') stored;
alter table public.node_states add constraint node_states_node_id_fk foreign key(user_id,node_id) references public.syllabus_nodes(user_id,id) deferrable initially deferred;
create index node_states_node_id_idx on public.node_states(user_id,node_id);
alter table public.card_reviews add constraint review_rating check(data->>'rating' in ('again','hard','good','easy'));
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
 when 'competitions' then 'competitions'
 when 'syllabi' then 'syllabi'
 when 'folders' then 'folders'
 when 'cards' then 'cards'
 when 'reviews' then 'card_reviews'
 when 'psychTests' then 'psych_tests'
 when 'attempts' then 'psych_attempts'
 when 'studyNodes' then 'syllabus_nodes'
 when 'studyTasks' then 'study_tasks'
 when 'studySessions' then 'study_sessions'
 when 'nodeStates' then 'node_states'
 when 'annotations' then 'annotations'
 when 'settings' then 'user_settings'
 else null end;
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
 select 'competitions'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.competitions where user_id=auth.uid() and revision>after_revision
 union all
 select 'syllabi'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.syllabi where user_id=auth.uid() and revision>after_revision
 union all
 select 'folders'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.folders where user_id=auth.uid() and revision>after_revision
 union all
 select 'cards'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.cards where user_id=auth.uid() and revision>after_revision
 union all
 select 'reviews'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.card_reviews where user_id=auth.uid() and revision>after_revision
 union all
 select 'psychTests'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.psych_tests where user_id=auth.uid() and revision>after_revision
 union all
 select 'attempts'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.psych_attempts where user_id=auth.uid() and revision>after_revision
 union all
 select 'studyNodes'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.syllabus_nodes where user_id=auth.uid() and revision>after_revision
 union all
 select 'studyTasks'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.study_tasks where user_id=auth.uid() and revision>after_revision
 union all
 select 'studySessions'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.study_sessions where user_id=auth.uid() and revision>after_revision
 union all
 select 'nodeStates'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.node_states where user_id=auth.uid() and revision>after_revision
 union all
 select 'annotations'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.annotations where user_id=auth.uid() and revision>after_revision
 union all
 select 'settings'::text kind,id,data,revision,deleted_at is not null deleted,updated_at from public.user_settings where user_id=auth.uid() and revision>after_revision
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
