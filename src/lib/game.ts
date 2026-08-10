export type GameStatus = "idle" | "collecting" | "ready" | "spinning" | "reveal" | "trailer" | "voting" | "selected";

export type Player = {
  id: string;
  name: string;
  joinedAt: number;
  ready: boolean;
  vetoUsed: boolean;
};

export type Vote = { playerId: string; choice: "watch" | "skip" | "veto" };

export type MovieSubmission = {
  id: string;
  tmdbId: number | null;
  title: string;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterPath: string | null;
  overview: string | null;
  status: "available" | "rejected" | "accepted";
  playerId: string;
  submittedBy: string;
  slot: 1 | 2;
};

export type MovieCandidate = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterPath: string | null;
  overview: string | null;
};

export type GameState = {
  status: GameStatus;
  startedAt: number | null;
  players: Player[];
  movies: MovieSubmission[];
  currentMovieId: string | null;
  votes: Vote[];
};

export const emptyGame: GameState = {
  status: "idle",
  startedAt: null,
  players: [],
  movies: [],
  currentMovieId: null,
  votes: [],
};

export function createPlayer(name: string): Player {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    joinedAt: Date.now(),
    ready: false,
    vetoUsed: false,
  };
}
