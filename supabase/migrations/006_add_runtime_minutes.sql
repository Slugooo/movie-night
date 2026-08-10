-- Run this once in Supabase Dashboard -> SQL Editor.

alter table public.movie_submissions
  add column if not exists runtime_minutes smallint;
