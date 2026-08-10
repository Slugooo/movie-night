"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadedGame, loadActiveGame } from "@/lib/game-service";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

const initialGame: LoadedGame = { game: { status: "idle", startedAt: null, players: [], movies: [], currentMovieId: null, votes: [] }, gameId: null, currentPlayer: null, isHost: false };

export function useGame() {
  const [loadedGame, setLoadedGame] = useState<LoadedGame>(initialGame);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setError(null); setLoadedGame(await loadActiveGame()); }
    catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Could not load the game."); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    if (!hasSupabaseConfig) return;
    const channel = supabase!.channel("movie-night-game")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "movie_submissions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, refresh)
      .subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, [refresh]);

  return { game: loadedGame.game, gameId: loadedGame.gameId, currentPlayer: loadedGame.currentPlayer, isLoading, error, refresh };
}
