"use client";

import { GameState, emptyGame } from "@/lib/game";

const storageKey = "movie-night:game";
const channelName = "movie-night:game-events";

function readGame(): GameState {
  if (typeof window === "undefined") return emptyGame;

  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as GameState) : emptyGame;
  } catch {
    return emptyGame;
  }
}

export function saveGame(nextGame: GameState) {
  window.localStorage.setItem(storageKey, JSON.stringify(nextGame));
  new BroadcastChannel(channelName).postMessage(nextGame);
}

export function subscribeToGame(onChange: (game: GameState) => void) {
  const channel = new BroadcastChannel(channelName);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey) onChange(readGame());
  };

  channel.onmessage = (event: MessageEvent<GameState>) => onChange(event.data);
  window.addEventListener("storage", onStorage);

  return () => {
    channel.close();
    window.removeEventListener("storage", onStorage);
  };
}

export { readGame };
