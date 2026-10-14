begin;
-- Private assets; cross-user object downloads and writes are denied by storage RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('opogc-private','opogc-private',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp','image/gif'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy opogc_asset_read on storage.objects for select to authenticated using(bucket_id='opogc-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy opogc_asset_insert on storage.objects for insert to authenticated with check(bucket_id='opogc-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy opogc_asset_update on storage.objects for update to authenticated using(bucket_id='opogc-private' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='opogc-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy opogc_asset_delete on storage.objects for delete to authenticated using(bucket_id='opogc-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
