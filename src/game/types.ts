export type GameStatus = "lobby" | "playing" | "reveal";

export interface Contribution {
  playerId: string;
  text: string;
  turnNumber: number;
}

export interface Game {
  code: string;
  hostId: string;
  status: GameStatus;
  theme: string | null;
  totalRounds: number;
  currentTurn: number;
  playerOrder: string[];
  createdAt: Date | null;
  lastActivityAt: Date | null;
  /** Set when the host starts a new game from the reveal screen. */
  nextGameCode: string | null;
}

/** A game is considered abandoned after this much wall-clock inactivity. */
export const STALE_GAME_THRESHOLD_MS = 30 * 60 * 1000;

export interface Player {
  id: string;
  name: string;
  color: string;
  joinedAt: Date | null;
  isHost: boolean;
}

export interface Story {
  id: string;
  contributions: Contribution[];
  openSentenceOwner: string | null;
  lastUpdatedTurn: number;
  /** Map of playerId → true for players who hearted this story. */
  hearts: Record<string, true>;
}
