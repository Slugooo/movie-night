"use client";

// A plain iframe keeps YouTube from mutating React-owned DOM during a veto.
export function TrailerPlayer({ videoId }: { videoId: string; onEnded: () => void }) {
  return <iframe className="trailer" src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`} title="Movie trailer" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
}
