-- Lock in a movie only when every current player chooses "watch".
-- The final vote and game transition happen atomically, so subscribed host
-- screens remove the trailer as soon as the unanimous vote is complete.

create or replace function public.cast_vote(p_game_id uuid, p_movie_id uuid, p_choice text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  voter uuid;
  total_players integer;
  total_votes integer;
  watch_votes integer;
begin
  select id into voter
  from public.players
  where game_id = p_game_id and user_id = auth.uid();

  if voter is null then raise exception 'You have not joined this game'; end if;
  if not exists (
    select 1 from public.games
    where id = p_game_id and phase = 'voting' and current_movie_id = p_movie_id
  ) then raise exception 'Voting is not open'; end if;
  if p_choice not in ('watch', 'skip', 'veto') then raise exception 'Invalid vote'; end if;
  if p_choice = 'veto' and exists (
    select 1 from public.players where id = voter and veto_used
  ) then raise exception 'Your veto was already used'; end if;

  insert into public.votes (game_id, movie_id, player_id, choice)
  values (p_game_id, p_movie_id, voter, p_choice)
  on conflict (movie_id, player_id)
  do update set choice = excluded.choice;

  if p_choice = 'veto' then
    update public.players set veto_used = true where id = voter;
    update public.movie_submissions set status = 'rejected' where id = p_movie_id;
    update public.games set phase = 'ready', current_movie_id = null where id = p_game_id;
    return;
  end if;

  select count(*) into total_players from public.players where game_id = p_game_id;
  select count(*) into total_votes from public.votes where game_id = p_game_id and movie_id = p_movie_id;
  select count(*) into watch_votes from public.votes where game_id = p_game_id and movie_id = p_movie_id and choice = 'watch';

  if total_players > 0 and watch_votes = total_players then
    update public.movie_submissions set status = 'accepted' where id = p_movie_id;
    update public.games set phase = 'selected' where id = p_game_id;
  elsif total_votes >= total_players then
    update public.movie_submissions set status = 'rejected' where id = p_movie_id;
    update public.games set phase = 'ready', current_movie_id = null where id = p_game_id;
  end if;
end;
$$;

revoke all on function public.cast_vote(uuid, uuid, text) from public;
grant execute on function public.cast_vote(uuid, uuid, text) to authenticated;
