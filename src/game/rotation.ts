export function getStoryHolderIndex(
  storyIndex: number,
  turn: number,
  playerCount: number
): number {
  if (playerCount <= 0) {
    throw new Error("playerCount must be positive");
  }
  if (turn < 1) {
    throw new Error("turn is 1-indexed and must be >= 1");
  }
  const raw = (storyIndex + turn - 1) % playerCount;
  return raw < 0 ? raw + playerCount : raw;
}

export function getStoryHolder(
  storyIndex: number,
  turn: number,
  playerOrder: string[]
): string {
  const idx = getStoryHolderIndex(storyIndex, turn, playerOrder.length);
  return playerOrder[idx];
}

export function totalTurns(playerCount: number, totalRounds: number): number {
  // totalRounds full passes of 7-word turns, then one private finishing turn
  // where every player writes 1–14 words on their own story.
  return playerCount * totalRounds + 1;
}

export function getRound(turn: number, playerCount: number): number {
  return Math.floor((turn - 1) / playerCount) + 1;
}

/**
 * The "private finish" turn — the very last turn of the game, when every
 * player is back on their own story and may write 1–14 words to close it.
 * The natural rotation `(s + t - 1) % N` puts each player on their own
 * story when t ≡ 1 (mod N), and `playerCount * totalRounds + 1` is the
 * first such turn after every regular pass has completed.
 */
export function isFinalTurn(
  turn: number,
  playerCount: number,
  totalRounds: number
): boolean {
  return turn === playerCount * totalRounds + 1;
}
