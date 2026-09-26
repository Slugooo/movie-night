-- Accept the current movie as soon as no player can still veto it.
-- A yes vote is final for that round, so that player no longer counts as a
-- possible veto. Players who already spent their veto also cannot block it.

create or replace function public.cast_vote(p_game_id uuid, p_movie_id uuid, p_choice text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  voter uuid;
  locked_movie uuid;
  can_still_veto boolean;
begin
  -- Serialize votes for a round so simultaneous Yes votes cannot both miss
  -- the other vote and leave a movie stuck in the voting phase.
  select current_movie_id into locked_movie
  from public.games
  where id = p_game_id and phase = 'voting'
  for update;

  if locked_movie is distinct from p_movie_id then raise exception 'Voting is not open'; end if;

  select id into voter
  from public.players
  where game_id = p_game_id and user_id = auth.uid();

  if voter is null then raise exception 'You have not joined this game'; end if;
  if p_choice not in ('watch', 'veto') then raise exception 'Invalid vote'; end if;
  if exists (
    select 1 from public.votes
    where game_id = p_game_id and movie_id = p_movie_id and player_id = voter
  ) then raise exception 'Your vote is already in'; end if;
  if p_choice = 'veto' and exists (
    select 1 from public.players where id = voter and veto_used
  ) then raise exception 'Your veto was already used'; end if;

  insert into public.votes (game_id, movie_id, player_id, choice)
  values (p_game_id, p_movie_id, voter, p_choice);

  if p_choice = 'veto' then
    update public.players set veto_used = true where id = voter;
    update public.movie_submissions set status = 'rejected' where id = p_movie_id;
    update public.games set phase = 'ready', current_movie_id = null where id = p_game_id;
    return;
  end if;

  select exists (
    select 1
    from public.players player
    where player.game_id = p_game_id
      and not player.veto_used
      and not exists (
        select 1
        from public.votes vote
        where vote.game_id = p_game_id
          and vote.movie_id = p_movie_id
          and vote.player_id = player.id
          and vote.choice = 'watch'
      )
  ) into can_still_veto;

  if not can_still_veto then
    update public.movie_submissions set status = 'accepted' where id = p_movie_id;
    update public.games set phase = 'selected' where id = p_game_id;
  end if;
end;
$$;

revoke all on function public.cast_vote(uuid, uuid, text) from public;
grant execute on function public.cast_vote(uuid, uuid, text) to authenticated;
