-- Run this after 004 if it was interrupted or if you want the optional-ready/timed-trailer flow.

alter table public.games drop constraint if exists games_phase_check;
alter table public.games add constraint games_phase_check check (phase in ('collecting', 'ready', 'spinning', 'reveal', 'trailer', 'voting', 'selected'));

create or replace function public.start_round(p_game_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare picked_movie uuid;
begin
  if not exists (select 1 from games where id = p_game_id and host_user_id = auth.uid() and phase in ('collecting', 'ready')) then raise exception 'Only the host can spin'; end if;
  select id into picked_movie from movie_submissions where game_id = p_game_id and status = 'available' order by random() limit 1;
  if picked_movie is null then raise exception 'No movies remain in the pool'; end if;
  update games set phase = 'spinning', current_movie_id = picked_movie where id = p_game_id;
  return picked_movie;
end; $$;

create or replace function public.set_round_phase(p_game_id uuid, p_phase text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_phase not in ('reveal', 'trailer', 'voting') then raise exception 'Invalid phase'; end if;
  if not exists (select 1 from games where id = p_game_id and host_user_id = auth.uid()) then raise exception 'Only the host can advance the round'; end if;
  update games set phase = p_phase where id = p_game_id;
end; $$;

create or replace function public.finalize_round(p_game_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare current_movie uuid; watch_votes integer; total_votes integer;
begin
  if not exists (select 1 from games where id = p_game_id and host_user_id = auth.uid() and phase = 'voting') then raise exception 'Only the host can finalize voting'; end if;
  select current_movie_id into current_movie from games where id = p_game_id;
  update movie_submissions set status = 'accepted' where id = current_movie;
  update games set phase = 'selected' where id = p_game_id;
end; $$;

grant execute on function public.start_round(uuid), public.set_round_phase(uuid, text), public.finalize_round(uuid) to authenticated;
