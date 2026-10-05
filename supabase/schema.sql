-- =====================================================================
-- Northstar database schema
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (it only creates what's missing and refreshes rules).
--
-- BEFORE RUNNING: check the OWNER EMAIL line below. That email is the
-- only account that can see your Life and HQ data.
-- =====================================================================

-- ---------- who is the owner ----------
create table if not exists public.app_owner (
  id int primary key default 1 check (id = 1),
  email text not null
);
insert into public.app_owner (id, email)
values (1, 'belghazi.ab.adam@gmail.com')            -- OWNER EMAIL
on conflict (id) do update set email = excluded.email;
alter table public.app_owner enable row level security;  -- no policies: nobody reads it directly

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_owner
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- contractor portals ----------
create table if not exists public.portals (
  id text primary key,              -- same id as the team member in Northstar
  name text not null,
  email text not null,
  role text not null default '',
  drive_url text not null default '',
  enabled boolean not null default true,
  invited_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists portals_email_idx on public.portals (lower(email));

-- The portal id of whoever is logged in (null for the owner or strangers)
create or replace function public.my_portal() returns text
language sql stable security definer set search_path = public as $$
  select id from portals
  where enabled and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

-- ---------- owner's private data (goals, check-ins, wishlist, team, subs, settings) ----------
create table if not exists public.owner_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- pipeline tasks (separate so contractors can see their own) ----------
create table if not exists public.tasks (
  id text primary key,
  data jsonb not null,
  assignee text,                    -- team member id, null = you
  updated_at timestamptz not null default now()
);
create index if not exists tasks_assignee_idx on public.tasks (assignee);

-- ---------- portal checklists: "what you owe me" / "what I owe you" ----------
create table if not exists public.portal_items (
  id uuid primary key default gen_random_uuid(),
  portal_id text not null references public.portals (id) on delete cascade,
  kind text not null check (kind in ('owe_me', 'owe_you')),
  title text not null,
  detail text not null default '',
  status text not null default 'open' check (status in ('open', 'submitted', 'done')),
  file_path text,
  requested_by text not null default 'owner' check (requested_by in ('owner', 'contractor')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_items_portal_idx on public.portal_items (portal_id);

-- ---------- uploaded files (the bytes live in Storage bucket "files") ----------
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('portal', 'brand', 'task')),
  ref_id text not null default 'all',  -- portal id / task id / 'all'
  name text not null,
  path text not null unique,
  size bigint,
  mime text,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists files_ref_idx on public.files (scope, ref_id);

-- ---------- push notifications, weekly reviews, dedupe log ----------
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  keys jsonb not null,
  user_email text,
  created_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  content text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.notification_log (
  key text primary key,
  sent_at timestamptz not null default now()
);

-- ---------- keep updated_at fresh ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
drop trigger if exists items_touch on public.portal_items;
create trigger items_touch before update on public.portal_items for each row execute function public.touch_updated_at();
drop trigger if exists state_touch on public.owner_state;
create trigger state_touch before update on public.owner_state for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row-level security: the database itself enforces who sees what.
-- Owner: everything. Contractor: only their own portal, items, files,
-- the tasks assigned to them, and the shared brand kit.
-- =====================================================================
alter table public.portals enable row level security;
alter table public.owner_state enable row level security;
alter table public.tasks enable row level security;
alter table public.portal_items enable row level security;
alter table public.files enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reviews enable row level security;
alter table public.notification_log enable row level security;

do $$
declare t text;
begin
  -- owner can do anything on every table
  foreach t in array array['portals','owner_state','tasks','portal_items','files','push_subscriptions','reviews'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

drop policy if exists contractor_read on public.portals;
create policy contractor_read on public.portals for select to authenticated
  using (id = public.my_portal());

drop policy if exists contractor_read on public.tasks;
create policy contractor_read on public.tasks for select to authenticated
  using (assignee = public.my_portal());
drop policy if exists contractor_update on public.tasks;
create policy contractor_update on public.tasks for update to authenticated
  using (assignee = public.my_portal()) with check (assignee = public.my_portal());

drop policy if exists contractor_read on public.portal_items;
create policy contractor_read on public.portal_items for select to authenticated
  using (portal_id = public.my_portal());
drop policy if exists contractor_request on public.portal_items;
create policy contractor_request on public.portal_items for insert to authenticated
  with check (portal_id = public.my_portal() and kind = 'owe_you' and requested_by = 'contractor');
drop policy if exists contractor_update on public.portal_items;
create policy contractor_update on public.portal_items for update to authenticated
  using (portal_id = public.my_portal()) with check (portal_id = public.my_portal());
drop policy if exists contractor_delete on public.portal_items;
create policy contractor_delete on public.portal_items for delete to authenticated
  using (portal_id = public.my_portal() and requested_by = 'contractor');

drop policy if exists contractor_read on public.files;
create policy contractor_read on public.files for select to authenticated using (
  scope = 'brand'
  or (scope = 'portal' and ref_id = public.my_portal())
  or (scope = 'task' and exists (select 1 from public.tasks t where t.id = files.ref_id and t.assignee = public.my_portal()))
);
drop policy if exists contractor_upload on public.files;
create policy contractor_upload on public.files for insert to authenticated
  with check (scope = 'portal' and ref_id = public.my_portal());

-- =====================================================================
-- Storage: one private bucket. Paths: brand/…, portal/<id>/…, task/<id>/…
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)   -- 50 MB per file
on conflict (id) do nothing;

drop policy if exists northstar_owner_all on storage.objects;
create policy northstar_owner_all on storage.objects for all to authenticated
  using (bucket_id = 'files' and public.is_owner())
  with check (bucket_id = 'files' and public.is_owner());

drop policy if exists northstar_contractor_read on storage.objects;
create policy northstar_contractor_read on storage.objects for select to authenticated using (
  bucket_id = 'files' and (
    (storage.foldername(name))[1] = 'brand'
    or ((storage.foldername(name))[1] = 'portal' and (storage.foldername(name))[2] = public.my_portal())
    or ((storage.foldername(name))[1] = 'task' and exists (
          select 1 from public.tasks t
          where t.id = (storage.foldername(name))[2] and t.assignee = public.my_portal()))
  )
);

drop policy if exists northstar_contractor_upload on storage.objects;
create policy northstar_contractor_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'files'
  and (storage.foldername(name))[1] = 'portal'
  and (storage.foldername(name))[2] = public.my_portal()
);

-- helpers only describe the signed-in caller; strangers don't need them
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.my_portal() from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.my_portal() to authenticated;

-- =====================================================================
-- Live updates (so a contractor moving a card shows up in your Pipeline)
-- =====================================================================
do $$
begin
  begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.portal_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.files; exception when duplicate_object then null; end;
end $$;
