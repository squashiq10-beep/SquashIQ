create table if not exists public.player_profiles (
  id uuid primary key,
  full_name text not null check (char_length(full_name) <= 100),
  email text not null check (char_length(email) <= 254),
  age smallint not null check (age between 8 and 100),
  skill_level text not null check (skill_level in ('new', 'recreational', 'competitive', 'advanced')),
  goal text not null check (goal in ('balanced', 'match-fitness', 'movement', 'racket-skills')),
  training_days text[] not null check (cardinality(training_days) between 2 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.player_schedules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.player_profiles(id),
  goal text not null,
  sessions jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.player_videos (
  id uuid primary key,
  player_name text not null check (char_length(player_name) <= 100),
  player_email text not null check (char_length(player_email) <= 254),
  title text not null check (char_length(title) <= 120),
  notes text check (char_length(notes) <= 1000),
  storage_path text not null unique,
  content_type text not null check (content_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  file_size bigint not null check (file_size between 1 and 104857600),
  created_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;
alter table public.player_schedules enable row level security;
alter table public.player_videos enable row level security;

grant insert on public.player_profiles, public.player_schedules, public.player_videos to anon;
grant insert on storage.objects to anon;

drop policy if exists "Players can submit profiles" on public.player_profiles;
create policy "Players can submit profiles" on public.player_profiles
  for insert to anon with check (true);

drop policy if exists "Players can submit schedules" on public.player_schedules;
create policy "Players can submit schedules" on public.player_schedules
  for insert to anon with check (true);

drop policy if exists "Players can submit video metadata" on public.player_videos;
create policy "Players can submit video metadata" on public.player_videos
  for insert to anon with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-videos', 'player-videos', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Players can upload private videos" on storage.objects;
create policy "Players can upload private videos" on storage.objects
  for insert to anon with check (bucket_id = 'player-videos');