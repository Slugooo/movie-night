-- Run this once in Supabase Dashboard -> SQL Editor.

grant update on public.movie_submissions to authenticated;

create policy "players can change their own movie submissions"
on public.movie_submissions for update to authenticated
using (
  exists (
    select 1 from public.players
    where players.id = movie_submissions.player_id
      and players.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.players
    where players.id = movie_submissions.player_id
      and players.user_id = (select auth.uid())
  )
);
