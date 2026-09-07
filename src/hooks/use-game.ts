"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadedGame, loadActiveGame } from "@/lib/game-service";
import { subscribeToGame } from "@/lib/local-game-store";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

const initialGame: LoadedGame = { game: { status: "idle", startedAt: null, players: [], movies: [], currentMovieId: null, votes: [] }, gameId: null, roomCode: null, currentPlayer: null, isHost: false };

export function useGame() {
  const [loadedGame, setLoadedGame] = useState<LoadedGame>(initialGame);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const nextGame = await loadActiveGame();
      if (sequence !== refreshSequence.current) return;
      setError(null);
      setLoadedGame(nextGame);
    }
    catch (caughtError) {
      if (sequence === refreshSequence.current) setError(caughtError instanceof Error ? caughtError.message : "Could not load the game.");
    }
    finally { if (sequence === refreshSequence.current) setIsLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    if (!hasSupabaseConfig) {
      return subscribeToGame((game) => setLoadedGame((current) => ({ ...current, game })));
    }

    const onDatabaseChange = () => { void refresh(); };
    const channel = supabase!.channel("movie-night-game")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, onDatabaseChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, onDatabaseChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "movie_submissions" }, onDatabaseChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, onDatabaseChange)
      .subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 2500);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase!.removeChannel(channel);
    };
  }, [refresh]);

  return { game: loadedGame.game, gameId: loadedGame.gameId, roomCode: loadedGame.roomCode, currentPlayer: loadedGame.currentPlayer, isHost: loadedGame.isHost, isLoading, error, refresh };
}
