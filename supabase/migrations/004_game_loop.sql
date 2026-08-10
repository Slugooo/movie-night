-- Run this once in Supabase Dashboard -> SQL Editor.

alter table public.games add column phase text not null default 'collecting' check (phase in ('collecting', 'ready', 'spinning', 'reveal', 'trailer', 'voting', 'selected'));
alter table public.games add column current_movie_id uuid references public.movie_submissions(id);
alter table public.players add column ready boolean not null default false;
alter table public.players add column veto_used boolean not null default false;
alter table public.movie_submissions add column status text not null default 'available' check (status in ('available', 'rejected', 'accepted'));

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  movie_id uuid not null references public.movie_submissions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  choice text not null check (choice in ('watch', 'skip', 'veto')),
  unique (movie_id, player_id)
);
alter table public.votes enable row level security;
grant select on public.votes to authenticated;
create policy "authenticated users can read votes" on public.votes for select to authenticated using (true);

create or replace function public.set_player_ready(p_game_id uuid, p_ready boolean) returns void language plpgsql security definer set search_path = public as $$
declare player_row uuid;
begin
  select id into player_row from players where game_id = p_game_id and user_id = auth.uid();
  if player_row is null then raise exception 'You have not joined this game'; end if;
  update players set ready = p_ready where id = player_row;
  if p_ready and not exists (select 1 from players where game_id = p_game_id and not ready) then update games set phase = 'ready' where id = p_game_id and phase = 'collecting';
  elsif not p_ready then update games set phase = 'collecting' where id = p_game_id and phase = 'ready';
  end if;
end; $$;

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
  select count(*) into total_votes from votes where movie_id = current_movie;
  select count(*) into watch_votes from votes where movie_id = current_movie and choice = 'watch';
  if total_votes > 0 and watch_votes * 2 > total_votes then update movie_submissions set status = 'accepted' where id = current_movie; update games set phase = 'selected' where id = p_game_id;
  else update movie_submissions set status = 'rejected' where id = current_movie; update games set phase = 'ready', current_movie_id = null where id = p_game_id; end if;
end; $$;

create or replace function public.cast_vote(p_game_id uuid, p_movie_id uuid, p_choice text) returns void language plpgsql security definer set search_path = public as $$
declare voter uuid; total_players integer; total_votes integer; watch_votes integer;
begin
  select id into voter from players where game_id = p_game_id and user_id = auth.uid();
  if voter is null then raise exception 'You have not joined this game'; end if;
  if not exists (select 1 from games where id = p_game_id and phase = 'voting' and current_movie_id = p_movie_id) then raise exception 'Voting is not open'; end if;
  if p_choice not in ('watch', 'skip', 'veto') then raise exception 'Invalid vote'; end if;
  if p_choice = 'veto' and exists (select 1 from players where id = voter and veto_used) then raise exception 'Your veto was already used'; end if;
  insert into votes (game_id, movie_id, player_id, choice) values (p_game_id, p_movie_id, voter, p_choice) on conflict (movie_id, player_id) do update set choice = excluded.choice;
  if p_choice = 'veto' then update players set veto_used = true where id = voter; update movie_submissions set status = 'rejected' where id = p_movie_id; update games set phase = 'ready', current_movie_id = null where id = p_game_id; return; end if;
  select count(*) into total_players from players where game_id = p_game_id;
  select count(*) into total_votes from votes where movie_id = p_movie_id;
  if total_votes >= total_players then
    select count(*) into watch_votes from votes where movie_id = p_movie_id and choice = 'watch';
    if watch_votes * 2 > total_players then update movie_submissions set status = 'accepted' where id = p_movie_id; update games set phase = 'selected' where id = p_game_id;
    else update movie_submissions set status = 'rejected' where id = p_movie_id; update games set phase = 'ready', current_movie_id = null where id = p_game_id; end if;
  end if;
end; $$;

grant execute on function public.set_player_ready(uuid, boolean), public.start_round(uuid), public.set_round_phase(uuid, text), public.cast_vote(uuid, uuid, text), public.finalize_round(uuid) to authenticated;
alter publication supabase_realtime add table public.votes;
