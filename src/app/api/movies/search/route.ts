import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) return NextResponse.json({ results: [] });

  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "TMDB is not configured yet." }, { status: 503 });

  const endpoint = new URL("https://api.themoviedb.org/3/search/movie");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("language", "en-US");
  endpoint.searchParams.set("include_adult", "false");

  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" }, next: { revalidate: 3600 } });
  if (!response.ok) return NextResponse.json({ error: "Movie search is unavailable." }, { status: response.status });

  const payload = await response.json();
  const results = await Promise.all((payload.results ?? []).slice(0, 6).map(async (movie: { id: number; title: string; release_date?: string; poster_path?: string | null; overview?: string }) => {
    const detail = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : null);
    return {
    tmdbId: movie.id,
    title: movie.title,
    releaseYear: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
    runtimeMinutes: detail?.runtime ?? null,
    posterPath: movie.poster_path ?? null,
    overview: movie.overview || null,
  }; }));
  return NextResponse.json({ results });
}
