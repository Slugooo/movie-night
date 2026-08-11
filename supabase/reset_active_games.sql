-- One-time operational reset. Run in Supabase SQL Editor when a stale game is
-- blocking the app. This preserves users and historical game data.

update public.games
set status = 'ended'
where status = 'collecting';
