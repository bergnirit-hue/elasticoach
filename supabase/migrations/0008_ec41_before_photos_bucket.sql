-- EC-41: private Storage bucket for measurement "before" photos.
--
-- A "before" photo is health data of special sensitivity (Privacy Protection
-- Law, Amendment 13), so the bucket is PRIVATE (public = false) and read only
-- through short-lived signed URLs (createSignedUrl), never a public URL.
--
-- Path convention: `{uid}/<file>` — the first folder segment is the owner's
-- auth.uid(). Every policy checks (storage.foldername(name))[1] = auth.uid(),
-- so a user can only touch objects under their own folder. The bucket itself
-- is the "before photos" namespace, so no extra prefix is needed.
--
-- NOTE on coach access (EC-7, open product/legal question): whether a coach may
-- view a linked client's "before" photo is NOT decided. Default here is
-- OWNER-ONLY — there is deliberately no coach SELECT policy on these objects.
-- Do not add one without the EC-7 decision.

-- ---------------------------------------------------------------------------
-- Bucket. Keep public = false. file_size_limit / allowed_mime_types enforce
-- the 5MB + image-only limits at the storage layer too (defense in depth with
-- the app-side validation in app/(app)/me/photo.ts — keep the two in sync).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'before-photos',
  'before-photos',
  false,
  5242880, -- 5 * 1024 * 1024
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Storage RLS. RLS on storage.objects is already enabled by Supabase; we only
-- add owner-scoped policies for this bucket, restricted to authenticated users.
-- A user may insert / read / update / delete ONLY objects whose first path
-- segment equals their own uid.
-- ---------------------------------------------------------------------------
create policy "before_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'before-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "before_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'before-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "before_photos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'before-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'before-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "before_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'before-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
