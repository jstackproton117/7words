import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, ensureSignedIn } from "../firebase";
import { colorForJoinIndex } from "./colors";
import { generateGameCode, normalizeGameCode } from "./codes";
import { getStoryHolder, getStoryHolderIndex, isFinalTurn, totalTurns } from "./rotation";
import { STALE_GAME_THRESHOLD_MS } from "./types";
import { validateContribution } from "./validation";

/** Placeholder text inserted when the host skips a player's turn. */
export const SKIPPED_TEXT = "(skipped)";

/**
 * Compute the TTL timestamp for a game, 30 minutes from "now" (client clock).
 * Firestore's TTL feature deletes the doc within ~24 hours of this passing —
 * a backstop for the case where no client is around to call cleanupStaleGame.
 */
function newExpiresAt(): Timestamp {
  return Timestamp.fromMillis(Date.now() + STALE_GAME_THRESHOLD_MS);
}

// TODO (post-MVP): move turn/ownership enforcement server-side via Cloud
// Functions or stricter Firestore rules. Today the client-side transactions
// in this file are the only thing keeping a determined player from writing
// out-of-turn or to someone else's story.

const MAX_CODE_RETRIES = 8;

export interface CreateGameOptions {
  hostName: string;
  totalRounds: number;
  theme: string | null;
}

export async function createGame(opts: CreateGameOptions): Promise<string> {
  if (opts.totalRounds !== 2 && opts.totalRounds !== 3) {
    throw new Error("Rounds must be 2 or 3.");
  }
  const trimmedName = opts.hostName.trim();
  if (!trimmedName) throw new Error("Please enter a name.");

  const user = await ensureSignedIn();

  let code: string | null = null;
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const candidate = generateGameCode();
    const existing = await getDoc(doc(db, "games", candidate));
    if (!existing.exists()) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new Error("Couldn't generate a unique game code — please try again.");
  }

  const gameRef = doc(db, "games", code);
  const playerRef = doc(db, "games", code, "players", user.uid);

  const batch = writeBatch(db);
  batch.set(gameRef, {
    hostId: user.uid,
    status: "lobby",
    theme: opts.theme?.trim() ? opts.theme.trim() : null,
    totalRounds: opts.totalRounds,
    currentTurn: 0,
    playerOrder: [],
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    expiresAt: newExpiresAt(),
  });
  batch.set(playerRef, {
    name: trimmedName,
    color: colorForJoinIndex(0),
    joinedAt: serverTimestamp(),
    isHost: true,
  });
  await batch.commit();

  return code;
}

export async function joinGame(
  rawCode: string,
  name: string
): Promise<{ code: string; playerId: string }> {
  const code = normalizeGameCode(rawCode);
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Please enter a name.");

  const user = await ensureSignedIn();
  const gameRef = doc(db, "games", code);
  const playersCol = collection(db, "games", code, "players");
  const playerRef = doc(playersCol, user.uid);

  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error("No game with that code.");
  const game = gameSnap.data();
  if (game.status !== "lobby") {
    throw new Error("That game has already started.");
  }

  const existingPlayer = await getDoc(playerRef);
  if (existingPlayer.exists()) {
    // Already joined from this device — just update the name.
    await setDoc(
      playerRef,
      { name: trimmedName },
      { merge: true }
    );
    return { code, playerId: user.uid };
  }

  // TODO: assigning color by current player count has a mild race condition
  // — two simultaneous joiners could land on the same color. Cosmetic only.
  const playersSnap = await getDocs(playersCol);
  await setDoc(playerRef, {
    name: trimmedName,
    color: colorForJoinIndex(playersSnap.size),
    joinedAt: serverTimestamp(),
    isHost: false,
  });

  return { code, playerId: user.uid };
}

export async function leaveLobby(rawCode: string): Promise<void> {
  const code = normalizeGameCode(rawCode);
  const user = await ensureSignedIn();
  const gameRef = doc(db, "games", code);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) return;
  const game = gameSnap.data();
  if (game.status !== "lobby") {
    throw new Error("You can't leave once the game has started.");
  }
  if (game.hostId === user.uid) {
    throw new Error("Use Cancel game instead — the host can't just leave.");
  }
  const playerRef = doc(db, "games", code, "players", user.uid);
  await deleteDoc(playerRef);
}

export async function cancelGame(rawCode: string): Promise<void> {
  const code = normalizeGameCode(rawCode);
  const user = await ensureSignedIn();
  const gameRef = doc(db, "games", code);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) return;
  const game = gameSnap.data();
  if (game.hostId !== user.uid) {
    throw new Error("Only the host can cancel the game.");
  }

  // Cancel works at any status — lobby, playing, or reveal.
  const [playersSnap, storiesSnap] = await Promise.all([
    getDocs(collection(db, "games", code, "players")),
    getDocs(collection(db, "games", code, "stories")),
  ]);
  const batch = writeBatch(db);
  for (const p of playersSnap.docs) batch.delete(p.ref);
  for (const s of storiesSnap.docs) batch.delete(s.ref);
  batch.delete(gameRef);
  await batch.commit();
}

export async function renameSelf(
  rawCode: string,
  newName: string
): Promise<void> {
  const code = normalizeGameCode(rawCode);
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Please enter a name.");
  const user = await ensureSignedIn();
  const playerRef = doc(db, "games", code, "players", user.uid);
  await updateDoc(playerRef, { name: trimmed });
}

export async function startGame(rawCode: string): Promise<void> {
  const code = normalizeGameCode(rawCode);
  const user = await ensureSignedIn();
  const gameRef = doc(db, "games", code);

  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error("Game not found.");
  const game = gameSnap.data();
  if (game.hostId !== user.uid) {
    throw new Error("Only the host can start the game.");
  }
  if (game.status !== "lobby") {
    throw new Error("The game has already started.");
  }

  const playersSnap = await getDocs(
    query(collection(db, "games", code, "players"), orderBy("joinedAt"))
  );
  const playerOrder = playersSnap.docs.map((d) => d.id);
  if (playerOrder.length < 3) {
    throw new Error("You need at least 3 players to start.");
  }

  const batch = writeBatch(db);
  for (const pid of playerOrder) {
    // Story id === the original author's player id.
    batch.set(doc(db, "games", code, "stories", pid), {
      contributions: [],
      openSentenceOwner: null,
      lastUpdatedTurn: 0,
    });
  }
  batch.update(gameRef, {
    status: "playing",
    playerOrder,
    currentTurn: 1,
    lastActivityAt: serverTimestamp(),
    expiresAt: newExpiresAt(),
  });
  await batch.commit();
}

export interface SubmitContributionInput {
  code: string;
  storyId: string;
  text: string;
}

export async function submitContribution(
  input: SubmitContributionInput
): Promise<void> {
  const code = normalizeGameCode(input.code);
  const user = await ensureSignedIn();
  const gameRef = doc(db, "games", code);
  const storyRef = doc(db, "games", code, "stories", input.storyId);

  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef);
    const storySnap = await tx.get(storyRef);
    if (!gameSnap.exists()) throw new Error("Game not found.");
    if (!storySnap.exists()) throw new Error("Story not found.");

    const game = gameSnap.data();
    const story = storySnap.data();

    if (game.status !== "playing") {
      throw new Error("The game is not currently in play.");
    }

    const playerOrder: string[] = game.playerOrder ?? [];
    const playerCount = playerOrder.length;
    const turn: number = game.currentTurn;

    const storyIdx = playerOrder.indexOf(input.storyId);
    if (storyIdx === -1) throw new Error("That story isn't part of this game.");

    const expectedHolder = getStoryHolder(storyIdx, turn, playerOrder);
    if (expectedHolder !== user.uid) {
      throw new Error("It's not your turn for this story.");
    }

    if ((story.lastUpdatedTurn ?? 0) >= turn) {
      throw new Error("You already wrote for this turn.");
    }

    // The relaxed 1–14 word limit only applies on the private finishing turn,
    // which is the single extra turn after all rotation rounds. The rotation
    // naturally puts each player on their own story on that turn — and the
    // expectedHolder check above already prevents writing on someone else's.
    const finalRound = isFinalTurn(turn, playerCount, game.totalRounds);
    const result = validateContribution({
      text: input.text,
      openSentenceOwner: story.openSentenceOwner ?? null,
      playerId: user.uid,
      isFinalRound: finalRound,
    });
    if (!result.ok) {
      throw new Error(result.reason);
    }

    const next = {
      contributions: [
        ...(story.contributions ?? []),
        {
          playerId: user.uid,
          text: input.text.trim(),
          turnNumber: turn,
        },
      ],
      openSentenceOwner: result.newOpenOwner,
      lastUpdatedTurn: turn,
    };
    tx.update(storyRef, next);
    tx.update(gameRef, {
      lastActivityAt: serverTimestamp(),
      expiresAt: newExpiresAt(),
    });
  });
}

export async function skipPlayer(
  rawCode: string,
  storyId: string
): Promise<void> {
  const code = normalizeGameCode(rawCode);
  const user = await ensureSignedIn();
  const gameRef = doc(db, "games", code);
  const storyRef = doc(db, "games", code, "stories", storyId);

  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef);
    const storySnap = await tx.get(storyRef);
    if (!gameSnap.exists()) throw new Error("Game not found.");
    if (!storySnap.exists()) throw new Error("Story not found.");

    const game = gameSnap.data();
    const story = storySnap.data();

    if (game.hostId !== user.uid) {
      throw new Error("Only the host can skip a player.");
    }
    if (game.status !== "playing") {
      throw new Error("The game isn't in progress.");
    }

    const playerOrder: string[] = game.playerOrder ?? [];
    const turn: number = game.currentTurn;
    const storyIdx = playerOrder.indexOf(storyId);
    if (storyIdx === -1) {
      throw new Error("That story isn't part of this game.");
    }
    if ((story.lastUpdatedTurn ?? 0) >= turn) {
      throw new Error("This story has already been written for this turn.");
    }

    const holderIdx = getStoryHolderIndex(storyIdx, turn, playerOrder.length);
    const expectedHolder = playerOrder[holderIdx];

    tx.update(storyRef, {
      contributions: [
        ...(story.contributions ?? []),
        {
          playerId: expectedHolder,
          text: SKIPPED_TEXT,
          turnNumber: turn,
        },
      ],
      // Skipping doesn't open or close a sentence — ownership is unchanged.
      lastUpdatedTurn: turn,
    });
    tx.update(gameRef, {
      lastActivityAt: serverTimestamp(),
      expiresAt: newExpiresAt(),
    });
  });
}

export async function advanceTurnIfReady(rawCode: string): Promise<void> {
  const code = normalizeGameCode(rawCode);
  const gameRef = doc(db, "games", code);

  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef);
    if (!gameSnap.exists()) return;
    const game = gameSnap.data();
    if (game.status !== "playing") return;

    const playerOrder: string[] = game.playerOrder ?? [];
    const turn: number = game.currentTurn;

    const storyRefs = playerOrder.map((pid) =>
      doc(db, "games", code, "stories", pid)
    );
    const storySnaps = await Promise.all(storyRefs.map((r) => tx.get(r)));

    const allWritten = storySnaps.every(
      (s) => s.exists() && (s.data()!.lastUpdatedTurn ?? 0) >= turn
    );
    if (!allWritten) return;

    const total = totalTurns(playerOrder.length, game.totalRounds);
    const nextTurn = turn + 1;
    if (nextTurn > total) {
      tx.update(gameRef, {
        status: "reveal",
        currentTurn: nextTurn,
        lastActivityAt: serverTimestamp(),
        expiresAt: newExpiresAt(),
      });
    } else {
      tx.update(gameRef, {
        currentTurn: nextTurn,
        lastActivityAt: serverTimestamp(),
        expiresAt: newExpiresAt(),
      });
    }
  });
}

export async function toggleHeart(
  rawCode: string,
  storyId: string
): Promise<void> {
  const code = normalizeGameCode(rawCode);
  const user = await ensureSignedIn();
  const storyRef = doc(db, "games", code, "stories", storyId);

  await runTransaction(db, async (tx) => {
    const storySnap = await tx.get(storyRef);
    if (!storySnap.exists()) throw new Error("Story not found.");
    const story = storySnap.data();
    const hearts: Record<string, true> = { ...(story.hearts ?? {}) };
    if (hearts[user.uid]) {
      delete hearts[user.uid];
    } else {
      hearts[user.uid] = true;
    }
    tx.update(storyRef, { hearts });
  });
}

/**
 * Host-only. Spins up a new game with the same theme and round count, then
 * writes a `nextGameCode` pointer on the old game so the other players' reveal
 * screens can pick it up and offer a "join the next game" affordance.
 */
export async function startNextGame(rawCode: string): Promise<string> {
  const code = normalizeGameCode(rawCode);
  const user = await ensureSignedIn();
  const oldGameRef = doc(db, "games", code);

  const oldGameSnap = await getDoc(oldGameRef);
  if (!oldGameSnap.exists()) throw new Error("Game not found.");
  const oldGame = oldGameSnap.data();
  if (oldGame.hostId !== user.uid) {
    throw new Error("Only the host can start a new game.");
  }
  if (oldGame.nextGameCode) {
    return oldGame.nextGameCode as string;
  }

  const hostPlayerRef = doc(db, "games", code, "players", user.uid);
  const hostPlayerSnap = await getDoc(hostPlayerRef);
  if (!hostPlayerSnap.exists()) {
    throw new Error("Couldn't find your player record.");
  }
  const hostName = hostPlayerSnap.data().name as string;

  const newCode = await createGame({
    hostName,
    totalRounds: oldGame.totalRounds,
    theme: oldGame.theme ?? null,
  });

  await updateDoc(oldGameRef, { nextGameCode: newCode });
  return newCode;
}

export interface SubmitQuipInput {
  text: string;
  name?: string;
}

/**
 * Saves a player-submitted tip into the global moderation queue. Approved
 * entries are surfaced into the rotating tip pool at runtime — see the
 * `feedback` rules in firestore.rules.
 */
export async function submitQuip(input: SubmitQuipInput): Promise<void> {
  await ensureSignedIn();
  const text = input.text.trim();
  if (!text) throw new Error("Please enter a quip.");
  if (text.length > 100) throw new Error("Keep it under 100 characters.");
  const rawName = input.name?.trim();
  const name = rawName && rawName.length > 0 ? rawName.slice(0, 40) : null;
  await addDoc(collection(db, "feedback"), {
    text,
    name,
    submittedAt: serverTimestamp(),
    approved: false,
  });
}

export async function cleanupStaleGame(rawCode: string): Promise<void> {
  const code = normalizeGameCode(rawCode);
  await ensureSignedIn();
  const gameRef = doc(db, "games", code);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) return;
  const game = gameSnap.data();

  const lastActivity = game.lastActivityAt;
  if (!lastActivity || typeof lastActivity.toMillis !== "function") {
    throw new Error("Game has no activity timestamp.");
  }
  const ageMs = Date.now() - lastActivity.toMillis();
  if (ageMs < STALE_GAME_THRESHOLD_MS) {
    throw new Error("Game is not stale yet.");
  }

  const [playersSnap, storiesSnap] = await Promise.all([
    getDocs(collection(db, "games", code, "players")),
    getDocs(collection(db, "games", code, "stories")),
  ]);
  const batch = writeBatch(db);
  for (const p of playersSnap.docs) batch.delete(p.ref);
  for (const s of storiesSnap.docs) batch.delete(s.ref);
  batch.delete(gameRef);
  await batch.commit();
}
