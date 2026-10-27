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

create table if not exists public.coach_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.player_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 100),
  player_email text not null check (char_length(player_email) <= 254),
  consent_confirmed boolean not null default false,
  intake jsonb not null,
  video_path text not null unique,
  video_content_type text not null check (video_content_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  video_size bigint not null check (video_size between 1 and 104857600),
  status text not null default 'submitted' check (status in ('submitted', 'drafting', 'draft_ready', 'published')),
  final_feedback text,
  coach_id uuid references auth.users(id),
  coach_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_ai_drafts (
  submission_id uuid primary key references public.player_submissions(id) on delete cascade,
  ai_draft text not null,
  model text not null,
  created_at timestamptz not null default now()
);

alter table public.player_submissions drop constraint if exists player_submissions_status_check;
alter table public.player_submissions
  add constraint player_submissions_status_check check (status in ('submitted', 'drafting', 'draft_ready', 'published'));

alter table public.player_profiles enable row level security;
alter table public.player_schedules enable row level security;
alter table public.player_videos enable row level security;
alter table public.coach_users enable row level security;
alter table public.player_submissions enable row level security;
alter table public.coach_ai_drafts enable row level security;

grant insert on public.player_profiles, public.player_schedules, public.player_videos to anon;

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
revoke insert on storage.objects from anon;

grant select on public.coach_users to authenticated;
grant select, insert on public.player_submissions to authenticated;
grant update (status, final_feedback, coach_id, coach_updated_at) on public.player_submissions to authenticated;
grant select on public.coach_ai_drafts to authenticated;
grant insert on storage.objects to authenticated;

drop policy if exists "Users can read own coach membership" on public.coach_users;
create policy "Users can read own coach membership" on public.coach_users
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Players and coaches can read submissions" on public.player_submissions;
create policy "Players and coaches can read submissions" on public.player_submissions
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.coach_users where user_id = auth.uid())
  );

drop policy if exists "Players can submit own intake" on public.player_submissions;
create policy "Players can submit own intake" on public.player_submissions
  for insert to authenticated with check (
    user_id = auth.uid()
    and consent_confirmed
    and status = 'submitted'
    and final_feedback is null
    and coach_id is null
    and (storage.foldername(video_path))[1] = auth.uid()::text
  );

drop policy if exists "Coaches can publish feedback" on public.player_submissions;
create policy "Coaches can publish feedback" on public.player_submissions
  for update to authenticated
  using (exists (select 1 from public.coach_users where user_id = auth.uid()))
  with check (exists (select 1 from public.coach_users where user_id = auth.uid()));

drop policy if exists "Coaches can read AI drafts" on public.coach_ai_drafts;
create policy "Coaches can read AI drafts" on public.coach_ai_drafts
  for select to authenticated using (
    exists (select 1 from public.coach_users where user_id = auth.uid())
  );

drop policy if exists "Players upload own private videos" on storage.objects;
create policy "Players upload own private videos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'player-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Coaches review private player videos" on storage.objects;
create policy "Coaches review private player videos" on storage.objects
  for select to authenticated using (
    bucket_id = 'player-videos'
    and exists (select 1 from public.coach_users where user_id = auth.uid())
  );