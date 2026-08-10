-- Run this whole file in Supabase Dashboard -> SQL Editor.
-- Then enable Anonymous Sign-Ins in Authentication -> Providers.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'collecting' check (status in ('collecting', 'ended')),
  started_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  joined_at timestamptz not null default now(),
  unique (game_id, user_id)
);

alter table public.games enable row level security;
alter table public.players enable row level security;

grant select, insert, update on public.games to authenticated;
grant select, insert, update on public.players to authenticated;

create policy "authenticated users can read games"
on public.games for select to authenticated using (true);

create policy "users can create games they host"
on public.games for insert to authenticated with check (host_user_id = (select auth.uid()));

create policy "hosts can end their games"
on public.games for update to authenticated
using (host_user_id = (select auth.uid()))
with check (host_user_id = (select auth.uid()));

create policy "authenticated users can read players"
on public.players for select to authenticated using (true);

create policy "users can join as themselves"
on public.players for insert to authenticated with check (user_id = (select auth.uid()));

create policy "users can update their own player"
on public.players for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.games, public.players;
