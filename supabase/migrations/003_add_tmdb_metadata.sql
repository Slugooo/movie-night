-- Run this once in Supabase Dashboard -> SQL Editor.

alter table public.movie_submissions
  add column tmdb_id integer,
  add column release_year smallint,
  add column poster_path text,
  add column overview text;
