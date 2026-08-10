-- Run this once in Supabase Dashboard -> SQL Editor.

create table public.movie_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  slot smallint not null check (slot in (1, 2)),
  created_at timestamptz not null default now(),
  unique (player_id, slot)
);

alter table public.movie_submissions enable row level security;
grant select, insert on public.movie_submissions to authenticated;
create policy "authenticated users can read movie submissions" on public.movie_submissions for select to authenticated using (true);
create policy "players can submit their own two movies" on public.movie_submissions for insert to authenticated with check (exists (select 1 from public.players where players.id = movie_submissions.player_id and players.game_id = movie_submissions.game_id and players.user_id = (select auth.uid())));
alter publication supabase_realtime add table public.movie_submissions;
