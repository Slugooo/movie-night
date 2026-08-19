-- Give every game a simple, increasing room number.

create sequence if not exists public.game_room_code_seq start with 1 increment by 1;

alter table public.games add column if not exists room_code bigint;
alter table public.games alter column room_code set default nextval('public.game_room_code_seq');

update public.games
set room_code = nextval('public.game_room_code_seq')
where room_code is null;

select setval(
  'public.game_room_code_seq',
  coalesce(max(room_code), 1),
  count(*) > 0
)
from public.games;

alter sequence public.game_room_code_seq owned by public.games.room_code;
alter table public.games alter column room_code set not null;
create unique index if not exists games_room_code_key on public.games(room_code);

grant usage, select on sequence public.game_room_code_seq to authenticated;
