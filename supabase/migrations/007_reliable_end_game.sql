-- Make the public host screen's End game control authoritative.
-- The app uses anonymous authentication, so every browser calling this function
-- still has a valid Supabase user; the supplied game must also be active.

create or replace function public.end_game(p_game_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to end a game';
  end if;

  update public.games
  set status = 'ended'
  where id = p_game_id
    and status = 'collecting';

  return found;
end;
$$;

revoke all on function public.end_game(uuid) from public;
grant execute on function public.end_game(uuid) to authenticated;
