"use client";

import { GameState, MovieCandidate, MovieSubmission, Player, Vote, emptyGame } from "@/lib/game";
import { readGame, saveGame } from "@/lib/local-game-store";
import { ensureAnonymousSession, hasSupabaseConfig, supabase } from "@/lib/supabase";

type GameRow = { id: string; status: "collecting" | "ended"; phase: Exclude<GameState["status"], "idle">; started_at: string; current_movie_id: string | null };
type PlayerRow = { id: string; display_name: string; joined_at: string; ready: boolean; veto_used: boolean };
type MovieRow = { id: string; player_id: string; title: string; slot: 1 | 2; tmdb_id: number | null; release_year: number | null; runtime_minutes: number | null; poster_path: string | null; overview: string | null; status: "available" | "rejected" | "accepted" };
type VoteRow = { player_id: string; choice: "watch" | "skip" | "veto" };
export type LoadedGame = { game: GameState; gameId: string | null; currentPlayer: Player | null; isHost: boolean };

function mapPlayer(player: PlayerRow): Player { return { id: player.id, name: player.display_name, joinedAt: new Date(player.joined_at).getTime(), ready: player.ready, vetoUsed: player.veto_used }; }
function toGameState(game: GameRow, players: PlayerRow[], movies: MovieSubmission[], votes: Vote[]): GameState { return { status: game.status === "ended" ? "idle" : game.phase === "trailer" ? "voting" : game.phase, startedAt: new Date(game.started_at).getTime(), players: players.map(mapPlayer), movies, currentMovieId: game.current_movie_id, votes }; }

async function latestActiveGame(): Promise<GameRow | null> { const { data, error } = await supabase!.from("games").select("id, status, phase, started_at, current_movie_id").eq("status", "collecting").order("started_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data; }

export async function loadActiveGame(): Promise<LoadedGame> {
  if (!hasSupabaseConfig) return { game: readGame(), gameId: null, currentPlayer: null, isHost: false };
  const session = await ensureAnonymousSession(); const activeGame = await latestActiveGame();
  if (!activeGame) return { game: emptyGame, gameId: null, currentPlayer: null, isHost: false };
  const { data: players, error } = await supabase!.from("players").select("id, display_name, joined_at, ready, veto_used").eq("game_id", activeGame.id).order("joined_at", { ascending: true }); if (error) throw error;
  const { data: movies, error: moviesError } = await supabase!.from("movie_submissions").select("id, player_id, title, slot, tmdb_id, release_year, runtime_minutes, poster_path, overview, status").eq("game_id", activeGame.id).order("created_at", { ascending: true }); if (moviesError) throw moviesError;
  const { data: votes, error: votesError } = await supabase!.from("votes").select("player_id, choice").eq("game_id", activeGame.id); if (votesError) throw votesError;
  const { data: myRow, error: myError } = await supabase!.from("players").select("id, display_name, joined_at, ready, veto_used").eq("game_id", activeGame.id).eq("user_id", session!.user.id).maybeSingle(); if (myError) throw myError;
  const movieData: MovieSubmission[] = movies.filter((movie: MovieRow) => movie.status !== "rejected").map((movie: MovieRow) => ({ id: movie.id, playerId: movie.player_id, title: movie.title, slot: movie.slot, tmdbId: movie.tmdb_id, releaseYear: movie.release_year, runtimeMinutes: movie.runtime_minutes, posterPath: movie.poster_path, overview: movie.overview, status: movie.status, submittedBy: players.find((player) => player.id === movie.player_id)?.display_name ?? "Someone" }));
  return { game: toGameState(activeGame, players, movieData, votes.map((vote: VoteRow) => ({ playerId: vote.player_id, choice: vote.choice }))), gameId: activeGame.id, currentPlayer: myRow ? mapPlayer(myRow) : null, isHost: false };
}

export async function startGame(hostName: string) {
  const displayName = hostName.trim();
  if (!displayName) throw new Error("Enter a host name before starting the game.");

  if (!hasSupabaseConfig) {
    const host: Player = { id: crypto.randomUUID(), name: displayName, joinedAt: Date.now(), ready: false, vetoUsed: false };
    return saveGame({ ...emptyGame, status: "collecting", startedAt: Date.now(), players: [host] });
  }

  const session = await ensureAnonymousSession();
  const { data: game, error } = await supabase!
    .from("games")
    .insert({ host_user_id: session!.user.id })
    .select("id")
    .single();
  if (error) throw error;

  const { error: playerError } = await supabase!.from("players").insert({
    game_id: game.id,
    user_id: session!.user.id,
    display_name: displayName,
  });
  if (playerError) throw playerError;
}
export async function endGame(gameId: string | null) {
  if (!hasSupabaseConfig) return saveGame(emptyGame);
  if (!gameId) throw new Error("There is no active game to end.");

  await ensureAnonymousSession();
  const { data, error } = await supabase!.rpc("end_game", { p_game_id: gameId });
  if (error) throw error;
  if (!data) throw new Error("The active game could not be ended.");
}
export async function joinGame(name: string) { if (!hasSupabaseConfig) { const currentGame = readGame(); const player: Player = { id: crypto.randomUUID(), name: name.trim(), joinedAt: Date.now(), ready: false, vetoUsed: false }; return saveGame({ ...currentGame, players: [...currentGame.players, player] }); } const session = await ensureAnonymousSession(); const activeGame = await latestActiveGame(); if (!activeGame) throw new Error("The host has not started a game yet."); const { error } = await supabase!.from("players").upsert({ game_id: activeGame.id, user_id: session!.user.id, display_name: name.trim() }, { onConflict: "game_id,user_id" }); if (error) throw error; }
export async function submitMovie(movie: MovieCandidate, gameId: string, currentPlayer: Player, movieCount: number) { if (movieCount >= 2) throw new Error("You can add up to two movies."); if (!hasSupabaseConfig) { const currentGame = readGame(); return saveGame({ ...currentGame, movies: [...currentGame.movies, { id: crypto.randomUUID(), ...movie, playerId: currentPlayer.id, submittedBy: currentPlayer.name, slot: (movieCount + 1) as 1 | 2, status: "available" }] }); } const { error } = await supabase!.from("movie_submissions").insert({ game_id: gameId, player_id: currentPlayer.id, title: movie.title, tmdb_id: movie.tmdbId, release_year: movie.releaseYear, runtime_minutes: movie.runtimeMinutes, poster_path: movie.posterPath, overview: movie.overview, slot: movieCount + 1 }); if (error) throw error; }
export async function changeMovie(movie: MovieCandidate, movieId: string, currentPlayer: Player) { if (!hasSupabaseConfig) { const currentGame = readGame(); return saveGame({ ...currentGame, movies: currentGame.movies.map((submission) => submission.id === movieId && submission.playerId === currentPlayer.id ? { ...submission, ...movie } : submission) }); } const { error } = await supabase!.from("movie_submissions").update({ title: movie.title, tmdb_id: movie.tmdbId, release_year: movie.releaseYear, runtime_minutes: movie.runtimeMinutes, poster_path: movie.posterPath, overview: movie.overview }).eq("id", movieId); if (error) throw error; }
export async function setReady(gameId: string, _: Player, ready: boolean) { const { error } = await supabase!.rpc("set_player_ready", { p_game_id: gameId, p_ready: ready }); if (error) throw error; }
export async function startRound(gameId: string) { const { error } = await supabase!.rpc("start_round", { p_game_id: gameId }); if (error) throw error; }
export async function setRoundPhase(gameId: string, phase: "reveal" | "trailer" | "voting") { const { error } = await supabase!.rpc("set_round_phase", { p_game_id: gameId, p_phase: phase }); if (error) throw error; }
export async function finalizeRound(gameId: string) { const { error } = await supabase!.rpc("finalize_round", { p_game_id: gameId }); if (error) throw error; }
export async function castVote(gameId: string, movieId: string, choice: Vote["choice"]) { const { error } = await supabase!.rpc("cast_vote", { p_game_id: gameId, p_movie_id: movieId, p_choice: choice }); if (error) throw error; }
