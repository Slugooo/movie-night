import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "TMDB is not configured yet." }, { status: 503 });
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Invalid movie." }, { status: 400 });
  const endpoint = `https://api.themoviedb.org/3/movie/${id}?append_to_response=videos&language=en-US`;
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" }, next: { revalidate: 86400 } });
  if (!response.ok) return NextResponse.json({ error: "Movie details are unavailable." }, { status: response.status });
  const movie = await response.json();
  const trailer = (movie.videos?.results ?? []).find((video: { site: string; type: string }) => video.site === "YouTube" && video.type === "Trailer");
  return NextResponse.json({ trailerKey: trailer?.key ?? null, runtimeMinutes: movie.runtime ?? null });
}
