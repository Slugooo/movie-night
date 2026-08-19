"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrailerPlayer } from "@/components/trailer-player";
import { useGame } from "@/hooks/use-game";
import { MovieCandidate } from "@/lib/game";
import { castVote, changeMovie, endGame, finalizeRound, setRoundPhase, startGame, startRound, submitMovie } from "@/lib/game-service";

function posterUrl(path: string | null) { return path ? `https://image.tmdb.org/t/p/w185${path}` : null; }

export default function HostPage() {
  const { game, gameId, roomCode, currentPlayer, isLoading, error, refresh } = useGame();
  const [isWorking, setIsWorking] = useState(false);
  const [hostName, setHostName] = useState("");
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [movieSearch, setMovieSearch] = useState("");
  const [movieResults, setMovieResults] = useState<MovieCandidate[]>([]);
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  const isLive = game.status !== "idle";
  const currentMovie = game.movies.find((movie) => movie.id === game.currentMovieId) ?? null;
  const poolMovies = game.movies.filter((movie) => movie.status === "available");
  const previouslyPickedMovies = game.movies.filter((movie) => movie.status === "rejected");
  const hostMovies = currentPlayer ? game.movies.filter((movie) => movie.playerId === currentPlayer.id && movie.status !== "rejected") : [];
  const isPicking = game.status === "collecting" || game.status === "ready";
  const voteForPlayer = (playerId: string) => game.votes.find((vote) => vote.playerId === playerId);
  const currentHostVote = currentPlayer ? voteForPlayer(currentPlayer.id) : null;
  const hostCanVeto = game.status === "voting" && Boolean(gameId && currentMovie && currentPlayer && !currentPlayer.vetoUsed && !currentHostVote);
  const everyoneReady = game.players.length > 0 && game.players.every((player) => player.ready);

  useEffect(() => {
    if (!isPicking || movieSearch.trim().length < 2) { setMovieResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/movies/search?q=${encodeURIComponent(movieSearch)}`, { signal: controller.signal })
        .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
        .then(({ ok, payload }) => { if (!ok) throw new Error(payload.error ?? "Movie search failed."); setMovieResults(payload.results); })
        .catch((caughtError) => { if ((caughtError as Error).name !== "AbortError") setActionError(caughtError instanceof Error ? caughtError.message : "Movie search failed."); });
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [isPicking, movieSearch]);

  useEffect(() => {
    if (!currentMovie?.tmdbId || game.status !== "voting") {
      setTrailerKey(null);
      return;
    }
    void fetch(`/api/movies/${currentMovie.tmdbId}`)
      .then((response) => response.json())
      .then((data) => setTrailerKey(data.trailerKey ?? null))
      .catch(() => setTrailerKey(null));
  }, [currentMovie?.tmdbId, game.status]);

  useEffect(() => {
    if (!gameId || game.status !== "spinning") return;
    const timer = window.setTimeout(() => void work(() => setRoundPhase(gameId, "reveal")), 4300);
    return () => window.clearTimeout(timer);
  }, [game.status, gameId]);

  useEffect(() => {
    if (!gameId || game.status !== "reveal") return;
    const timer = window.setTimeout(() => void work(() => setRoundPhase(gameId, "voting")), 2400);
    return () => window.clearTimeout(timer);
  }, [game.status, gameId]);

  useEffect(() => {
    if (!gameId || game.status !== "trailer") return;
    const timer = window.setTimeout(() => void work(() => setRoundPhase(gameId, "voting")), 300);
    return () => window.clearTimeout(timer);
  }, [game.status, gameId]);

  async function work(action: () => Promise<void>) {
    setIsWorking(true);
    setActionError(null);
    try {
      await action();
      await refresh();
    } catch (caughtError) {
      const message = typeof caughtError === "object" && caughtError && "message" in caughtError
        ? String(caughtError.message)
        : "Could not advance the game.";
      setActionError(message);
    } finally {
      setIsWorking(false);
    }
  }

  const vetoCurrentMovie = () => work(() => castVote(gameId!, currentMovie!.id, "veto"));

  async function chooseHostMovie(movie: MovieCandidate) {
    if (!currentPlayer || !gameId) return;
    await work(async () => {
      if (editingMovieId) await changeMovie(movie, editingMovieId, currentPlayer);
      else await submitMovie(movie, gameId, currentPlayer, hostMovies.length);
      setEditingMovieId(null);
      setMovieSearch("");
      setMovieResults([]);
    });
  }

  let action: React.ReactNode = (
    <>
      <input aria-label="Host name" disabled={isWorking || isLoading} maxLength={24} onChange={(event) => setHostName(event.target.value)} placeholder="Host name" value={hostName} />
      <button disabled={isWorking || isLoading || !hostName.trim()} onClick={() => void work(() => startGame(hostName))}>{isWorking ? "Starting..." : "Start new game"}</button>
    </>
  );
  if (isLive && (game.status === "collecting" || game.status === "ready")) action = (
    <>
      <button disabled={isWorking || poolMovies.length === 0} onClick={() => void work(() => startRound(gameId!))}>{isWorking ? "Spinning..." : "Spin the wheel"}</button>
      <button className="secondary-button" disabled={isWorking} onClick={() => void work(() => endGame(gameId))}>End game</button>
    </>
  );
  if (game.status === "spinning" || game.status === "reveal") action = <button className="secondary-button" disabled>Revealing...</button>;
  if (game.status === "trailer") action = <button className="secondary-button" disabled>Starting trailer...</button>;
  if (game.status === "voting") action = hostCanVeto
    ? <button className="veto-button" disabled={isWorking} onClick={() => void vetoCurrentMovie()}>{isWorking ? "Vetoing..." : "Veto this movie"}</button>
    : <button className="secondary-button" disabled>{currentPlayer?.vetoUsed ? "Veto already used" : "Waiting for votes"}</button>;
  if (game.status === "selected") action = <button className="secondary-button" disabled={isWorking} onClick={() => void work(() => endGame(gameId))}>End game</button>;

  return (
    <main className={`host-shell${game.status === "voting" && trailerKey ? " host-shell-trailer" : ""}${isPicking ? " host-shell-picking" : ""}`}>
      <nav className="host-nav">
        <Link className="wordmark" href="/host">MOVIE NIGHT</Link>
        <span className={isLive ? "status-pill live" : "status-pill"}><span aria-hidden="true" /> {isLive ? game.status : "Not started"}</span>
      </nav>
      <section className="stage" aria-live="polite">
        {game.status === "spinning" ? <div className="wheel"><span aria-hidden="true">&#127916;</span></div> : (
          <>
            {currentMovie?.posterPath && <img className="winner-poster" alt="" src={`https://image.tmdb.org/t/p/w342${currentMovie.posterPath}`} />}
            <h1 className="stage-title">{game.status === "selected" ? currentMovie?.title ?? "Chosen" : currentMovie?.title ?? (isLive ? "Build the movie pool." : "Ready to pick a movie?")}</h1>
          </>
        )}
        {roomCode && isPicking && <p className="room-code">Join room <strong>{roomCode}</strong></p>}
        {game.status === "voting" && (trailerKey ? (
          <div className="trailer-shell">
            <TrailerPlayer videoId={trailerKey} onEnded={() => void work(() => finalizeRound(gameId!))} />
            {hostCanVeto && <button aria-label={`Veto ${currentMovie?.title ?? "this movie"}`} className="veto-button trailer-veto" disabled={isWorking} onClick={() => void vetoCurrentMovie()}>{isWorking ? "Vetoing..." : "Veto movie"}</button>}
          </div>
        ) : <p className="stage-copy">No trailer found. Finalize voting when ready.</p>)}
        {(game.status === "collecting" || game.status === "ready") && (
          <>
            <p className="stage-copy host-pick-copy">{everyoneReady ? "Everyone is ready. Spin when you are." : "Spin whenever the pool has a movie; readiness is optional."}</p>
            <div className="host-movie-picker">
              <div className="players-heading"><span>Your movie picks</span><strong>{hostMovies.length}/2</strong></div>
              <div className="host-movie-search">
                <label htmlFor="host-movie-search">Search movies</label>
                <input disabled={isWorking || (hostMovies.length >= 2 && !editingMovieId)} id="host-movie-search" maxLength={100} onChange={(event) => setMovieSearch(event.target.value)} placeholder="Try Parasite" value={movieSearch} />
              </div>
              {editingMovieId && <button className="text-button" onClick={() => { setEditingMovieId(null); setMovieSearch(""); setMovieResults([]); }} type="button">Cancel edit</button>}
              {movieResults.length > 0 && <ul className="host-movie-results">{movieResults.map((movie) => <li key={movie.tmdbId}><button disabled={isWorking} onClick={() => void chooseHostMovie(movie)} type="button">{posterUrl(movie.posterPath) ? <img alt="" src={posterUrl(movie.posterPath)!} /> : <span className="poster-placeholder" />}<span><strong>{movie.title}</strong>{movie.releaseYear && <small>{movie.releaseYear}</small>}</span></button></li>)}</ul>}
              {hostMovies.length > 0 && <ul className="host-submission-list">{hostMovies.map((movie) => <li key={movie.id}><span>{movie.title}{movie.releaseYear ? ` (${movie.releaseYear})` : ""}</span><button className="text-button" onClick={() => { setEditingMovieId(movie.id); setMovieSearch(movie.title); }} type="button">Change</button></li>)}</ul>}
            </div>
            <div className="players-panel host-pick-players">
              <div className="players-heading"><span>Players ready</span><strong>{game.players.filter((player) => player.ready).length}/{game.players.length}</strong></div>
              <ul className="player-grid">{game.players.map((player, index) => <li key={player.id}><span className={`avatar avatar-${index % 5}`}>{player.name.slice(0, 1).toUpperCase()}</span>{player.name}<small>{player.ready ? "Ready" : "Picking"}</small></li>)}</ul>
            </div>
            {poolMovies.length > 0 && (
              <div className="movie-pool host-pick-pool">
                <div className="players-heading"><span>Movie pool</span><strong>{poolMovies.length}</strong></div>
                <ul>{poolMovies.map((movie) => <li key={movie.id}>{movie.posterPath ? <img alt="" src={`https://image.tmdb.org/t/p/w92${movie.posterPath}`} /> : <span className="poster-placeholder" />}<span className="movie-pool-title">{movie.title}{movie.releaseYear && <small className="movie-year">({movie.releaseYear})</small>}</span>{movie.runtimeMinutes && <small className="movie-runtime">{Math.floor(movie.runtimeMinutes / 60)}h {movie.runtimeMinutes % 60}m</small>}<small className="movie-submitter">Added by {movie.submittedBy}</small></li>)}</ul>
              </div>
            )}
            {previouslyPickedMovies.length > 0 && (
              <div className="movie-history host-pick-history">
                <div className="players-heading"><span>Previously picked</span><strong>{previouslyPickedMovies.length}</strong></div>
                <ul>{previouslyPickedMovies.map((movie) => <li key={movie.id}><span>{movie.title}</span><small>{movie.releaseYear ?? ""}</small></li>)}</ul>
              </div>
            )}
          </>
        )}
        {game.status === "voting" && (
          <div className="players-panel vote-lobby">
            <div className="players-heading"><span>Lobby</span><strong>{game.players.length} players</strong></div>
            <ul className="player-grid">{game.players.map((player, index) => { const vote = voteForPlayer(player.id); return <li key={player.id}><span className={`avatar avatar-${index % 5}`}>{player.name.slice(0, 1).toUpperCase()}</span><span>{player.name}<small>{vote ? `Voted: ${vote.choice}` : "Choosing"}</small></span><small className={player.vetoUsed ? "veto-used" : "veto-ready"}>{player.vetoUsed ? "Veto used" : "Veto available"}</small></li>; })}</ul>
          </div>
        )}
        {game.status === "selected" && <p className="stage-copy">Tonight&apos;s movie is locked in. Enjoy.</p>}
      </section>
      <footer className="host-controls">
        <div className="control-buttons">{action}</div>
        <p>{actionError ?? error ?? "Cast or mirror this screen to the TV."}<br /><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></p>
      </footer>
    </main>
  );
}
