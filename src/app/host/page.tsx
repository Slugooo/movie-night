"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrailerPlayer } from "@/components/trailer-player";
import { useGame } from "@/hooks/use-game";
import { MovieCandidate, MovieSubmission } from "@/lib/game";
import { castVote, changeMovie, endGame, setRoundPhase, startGame, startRound, submitMovie } from "@/lib/game-service";

function posterUrl(path: string | null) { return path ? `https://image.tmdb.org/t/p/w185${path}` : null; }

function MovieDetails({ movie }: { movie: MovieCandidate | MovieSubmission }) {
  return <><span className="movie-pool-title">{movie.title}</span><span className="movie-card-meta">{movie.releaseYear && <span>{movie.releaseYear}</span>}{movie.runtimeMinutes ? <span className="movie-card-runtime">{Math.floor(movie.runtimeMinutes / 60) > 0 ? `${Math.floor(movie.runtimeMinutes / 60)}h ` : ""}{movie.runtimeMinutes % 60}m</span> : null}</span></>;
}

function MoviePoster({ movie }: { movie: MovieCandidate | MovieSubmission }) {
  return movie.posterPath ? <img alt="" src={posterUrl(movie.posterPath)!} /> : <span className="poster-placeholder" aria-hidden="true">🎬</span>;
}

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
  const remainingMovies = poolMovies.filter((movie) => movie.id !== currentMovie?.id);
  const isPicking = game.status === "collecting" || game.status === "ready";
  const voteForPlayer = (playerId: string) => game.votes.find((vote) => vote.playerId === playerId);
  const playersWhoCanStillVeto = game.players.filter((player) => !player.vetoUsed && voteForPlayer(player.id)?.choice !== "watch");
  const currentHostVote = currentPlayer ? voteForPlayer(currentPlayer.id) : null;
  const hostCanVoteYes = game.status === "voting" && Boolean(gameId && currentMovie && currentPlayer && !currentHostVote);
  const hostCanVeto = game.status === "voting" && Boolean(gameId && currentMovie && currentPlayer && !currentPlayer.vetoUsed && !currentHostVote);

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
  const approveCurrentMovie = () => work(() => castVote(gameId!, currentMovie!.id, "watch"));

  async function chooseHostMovie(movie: MovieCandidate) {
    if (!currentPlayer) return;
    await work(async () => {
      if (editingMovieId) await changeMovie(movie, editingMovieId, currentPlayer);
      else await submitMovie(movie, gameId ?? "local", currentPlayer, hostMovies.length);
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
      <button className="secondary-button end-game-button" disabled={isWorking} onClick={() => void work(() => endGame(gameId))}>End game</button>
    </>
  );
  if (game.status === "spinning" || game.status === "reveal") action = <button className="secondary-button" disabled>Revealing...</button>;
  if (game.status === "trailer") action = <button className="secondary-button" disabled>Starting trailer...</button>;
  if (game.status === "voting") action = currentHostVote
    ? <button className="secondary-button" disabled>{currentHostVote.choice === "watch" ? "You voted yes" : "Vote counted"}</button>
    : <div className="host-vote-actions"><button disabled={isWorking || !hostCanVoteYes} onClick={() => void approveCurrentMovie()}>{isWorking ? "Voting..." : "Yes"}</button>{hostCanVeto && <button className="veto-button" disabled={isWorking} onClick={() => void vetoCurrentMovie()}>Veto</button>}</div>;
  if (game.status === "selected") action = <button className="secondary-button end-game-button" disabled={isWorking} onClick={() => void work(() => endGame(gameId))}>End game</button>;

  return (
    <main className={`host-shell${game.status === "voting" && trailerKey ? " host-shell-trailer" : ""}${isPicking ? " host-shell-picking" : ""}${game.status === "idle" ? " host-shell-idle" : ""}${game.status === "selected" ? " host-shell-selected" : ""}`}>
      <nav className="host-nav">
        <Link className="wordmark" href="/host">MOVIE NIGHT</Link>
      </nav>
      <section className="stage" aria-live="polite">
        {game.status === "spinning" ? <div className="wheel"><span aria-hidden="true">&#127916;</span></div> : (
          <>
            {game.status === "selected" && <p className="chosen-label">Movie chosen!</p>}
            {currentMovie?.posterPath && <img className="winner-poster" alt="" src={`https://image.tmdb.org/t/p/w342${currentMovie.posterPath}`} />}
            {currentMovie && <h1 className="stage-title">{currentMovie.title}</h1>}
          </>
        )}
        {roomCode && isPicking && <p className="room-code">Join room <strong>{roomCode}</strong></p>}
        {game.status === "voting" && (trailerKey ? (
          <>
            <aside className="trailer-side-panel trailer-movies-panel">
              <div className="players-heading"><span>Movies remaining</span><strong>{remainingMovies.length}</strong></div>
              <ul className="remaining-movie-list">{remainingMovies.map((movie) => <li key={movie.id}><MoviePoster movie={movie} /><span className="movie-card-copy"><MovieDetails movie={movie} /></span></li>)}</ul>{remainingMovies.length === 0 && <p className="remaining-empty">Last movie in the pool</p>}
            </aside>
            <div className="trailer-shell">
              <TrailerPlayer videoId={trailerKey} />
            </div>
            <aside className="trailer-side-panel trailer-veto-panel">
              <div className="players-heading"><span>Can still veto</span><strong>{playersWhoCanStillVeto.length}</strong></div>
              <ul>{playersWhoCanStillVeto.map((player, index) => <li key={player.id}><span className={`avatar avatar-${index % 5}`}>{player.name.slice(0, 1).toUpperCase()}</span><span>{player.name}</span></li>)}</ul>
              {currentHostVote ? <p className="host-vote-confirmation">You voted yes</p> : <div className="host-vote-actions"><button aria-label={`Vote yes for ${currentMovie?.title ?? "this movie"}`} disabled={isWorking || !hostCanVoteYes} onClick={() => void approveCurrentMovie()}>{isWorking ? "Voting..." : "Yes"}</button>{hostCanVeto && <button aria-label={`Veto ${currentMovie?.title ?? "this movie"}`} className="veto-button" disabled={isWorking} onClick={() => void vetoCurrentMovie()}>Veto</button>}</div>}
            </aside>
          </>
        ) : <p className="stage-copy">No trailer found. Finalize voting when ready.</p>)}
        {(game.status === "collecting" || game.status === "ready") && (
          <>
            <div className="host-movie-picker">
              <div className="players-heading"><span>Your movie picks</span><strong>{hostMovies.length}/2</strong></div>
              <ul className="host-pick-slots">
                {[0, 1].map((index) => { const movie = hostMovies[index]; return <li key={index} className={movie ? "filled-pick" : "empty-pick"}>
                  {movie ? <><MoviePoster movie={movie} /><span className="movie-card-copy"><MovieDetails movie={movie} /></span><button className="text-button" aria-label={`Change ${movie.title}`} disabled={isWorking} onClick={() => { setEditingMovieId(movie.id); setMovieSearch(""); setMovieResults([]); }} type="button">Change</button></> : <><span className="pick-number">{index + 1}</span><span>{index === 0 ? "Choose your first movie" : "Choose a second movie"}<small>Search below to add a pick</small></span></>}
                </li>; })}
              </ul>
              {(hostMovies.length < 2 || editingMovieId) && <div className="host-search-area">
                <div className="host-movie-search">
                  <label htmlFor="host-movie-search">{editingMovieId ? "Replace your pick" : "Search movies"}</label>
                  <input aria-label="Search movies" autoComplete="off" disabled={isWorking} id="host-movie-search" maxLength={100} onChange={(event) => setMovieSearch(event.target.value)} placeholder={editingMovieId ? "Find a replacement…" : "Search for a movie…"} value={movieSearch} />
                </div>
                {editingMovieId && <button className="text-button cancel-pick-edit" onClick={() => { setEditingMovieId(null); setMovieSearch(""); setMovieResults([]); }} type="button">Cancel</button>}
                {movieResults.length > 0 && <ul className="host-movie-results" aria-label="Movie search results">{movieResults.map((movie) => <li key={movie.tmdbId}><button disabled={isWorking} onClick={() => void chooseHostMovie(movie)} type="button"><MoviePoster movie={movie} /><span className="movie-card-copy"><MovieDetails movie={movie} /></span></button></li>)}</ul>}
              </div>}
            </div>
            {(
              <div className="movie-pool host-pick-pool">
                <div className="players-heading"><span>Movie pool</span><strong>{poolMovies.length}</strong></div>
                {poolMovies.length === 0 && <p className="pool-empty">The lineup starts here.<span>Everyone can add up to two movies.</span></p>}
                <ul>{poolMovies.map((movie) => <li key={movie.id}><MoviePoster movie={movie} /><span className="movie-card-copy"><MovieDetails movie={movie} /><small className="movie-card-submitter">{movie.submittedBy}</small></span></li>)}</ul>
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
        {game.status === "selected" && <p className="stage-copy chosen-copy">Everyone&apos;s in. Tonight&apos;s movie is locked.</p>}
      </section>
      <footer className="host-controls">
        <div className="control-buttons">{action}</div>
        {(actionError || error) && <p className="host-error" role="alert">{actionError ?? error}</p>}
        {game.status === "idle" && <p className="tmdb-attribution"><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></p>}
      </footer>
    </main>
  );
}
