-- Let a guest remove their own player record and cascade-delete their picks/votes.
-- Hosts must end the game instead of leaving it.

create or replace function public.leave_game(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to leave a room';
  end if;

  delete from public.players
  where game_id = p_game_id
    and user_id = auth.uid()
    and not exists (
      select 1 from public.games
      where games.id = p_game_id
        and games.host_user_id = auth.uid()
    );

  return found;
end;
$$;

revoke all on function public.leave_game(uuid) from public;
grant execute on function public.leave_game(uuid) to authenticated;
