create extension if not exists "pgcrypto";

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  color text not null default '#0f766e',
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  ai_summary text,
  ai_keywords text[] not null default '{}',
  ai_topics text[] not null default '{}',
  ai_related_ids uuid[] not null default '{}',
  ai_suggested_actions jsonb not null default '[]'::jsonb,
  ai_urgency text check (ai_urgency in ('now', 'soon', 'later', 'archive')),
  ai_analyzed_at timestamptz,
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  source_path text,
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  entity_type text not null default 'space' check (entity_type in ('space', 'note', 'document')),
  entity_id uuid,
  title text not null,
  description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'doing', 'waiting', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos add column if not exists description text not null default '';
alter table public.todos add column if not exists entity_type text not null default 'space';
alter table public.todos add column if not exists entity_id uuid;
alter table public.todos drop constraint if exists todos_status_check;
alter table public.todos add constraint todos_status_check check (status in ('todo', 'doing', 'waiting', 'done'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'todos_entity_type_check'
  ) then
    alter table public.todos
      add constraint todos_entity_type_check check (entity_type in ('space', 'note', 'document'));
  end if;
end $$;

update public.todos
set entity_type = 'space',
    entity_id = space_id
where entity_id is null;

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  entity_type text not null default 'space' check (entity_type in ('space', 'note', 'document')),
  entity_id uuid,
  name text not null,
  path text not null,
  mime_type text not null default 'application/octet-stream',
  size bigint not null default 0,
  url text,
  created_at timestamptz not null default now()
);

alter table public.attachments
  add column if not exists entity_type text not null default 'space';

alter table public.attachments
  add column if not exists entity_id uuid;

alter table public.notes
  add column if not exists pinned boolean not null default false;

alter table public.notes
  add column if not exists archived boolean not null default false;

alter table public.notes
  add column if not exists ai_summary text;

alter table public.notes
  add column if not exists ai_keywords text[] not null default '{}';

alter table public.notes
  add column if not exists ai_topics text[] not null default '{}';

alter table public.notes
  add column if not exists ai_related_ids uuid[] not null default '{}';

alter table public.notes
  add column if not exists ai_suggested_actions jsonb not null default '[]'::jsonb;

alter table public.notes
  add column if not exists ai_urgency text;

alter table public.notes
  add column if not exists ai_analyzed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notes_ai_urgency_check'
  ) then
    alter table public.notes
      add constraint notes_ai_urgency_check check (ai_urgency in ('now', 'soon', 'later', 'archive'));
  end if;
end $$;

alter table public.documents
  add column if not exists pinned boolean not null default false;

alter table public.documents
  add column if not exists archived boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'attachments_entity_type_check'
  ) then
    alter table public.attachments
      add constraint attachments_entity_type_check check (entity_type in ('space', 'note', 'document'));
  end if;
end $$;

alter table public.spaces enable row level security;
alter table public.notes enable row level security;
alter table public.documents enable row level security;
alter table public.todos enable row level security;
alter table public.tags enable row level security;
alter table public.attachments enable row level security;

create policy "spaces owner access" on public.spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes owner access" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "documents owner access" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "todos owner access" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tags owner access" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "attachments owner access" on public.attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', true)
on conflict (id) do nothing;

create policy "workspace file read" on storage.objects
  for select using (bucket_id = 'workspace-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "workspace file write" on storage.objects
  for insert with check (bucket_id = 'workspace-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "workspace file update" on storage.objects
  for update using (bucket_id = 'workspace-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "workspace file delete" on storage.objects
  for delete using (bucket_id = 'workspace-files' and auth.uid()::text = (storage.foldername(name))[1]);
