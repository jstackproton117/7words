// Dev-only test bots. Each bot runs as its own Firebase app instance with
// its own anonymous-auth UID, so Firestore sees it as a genuinely separate
// player. Bots watch the game doc and, whenever it's their turn, submit a
// real 7-word contribution through the same validation path a human goes
// through — no fakery, no validator bypass. Tree-shaken out of production
// because nothing in non-dev code paths imports this file (the Lobby button
// that calls it is wrapped in `import.meta.env.DEV`).

import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  setDoc,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig } from "../firebase";
import { colorForJoinIndex } from "../game/colors";
import { getStoryHolder, isFinalTurn } from "../game/rotation";
import { STALE_GAME_THRESHOLD_MS } from "../game/types";
import { validateContribution } from "../game/validation";
import { randomSevenWords } from "./botWords";

export interface Bot {
  uid: string;
  name: string;
  stop: () => Promise<void>;
}

const BOT_NAMES = [
  "Bot Alice",
  "Bot Bob",
  "Bot Carol",
  "Bot Dave",
  "Bot Eve",
  "Bot Frank",
];

// Keyed by game code so the Lobby can render an accurate count even after
// re-mounts, and so back-to-back clicks pick fresh names without duplicating
// the lookup logic in the UI.
const activeBots = new Map<string, Bot[]>();

function newExpiresAt(): Timestamp {
  return Timestamp.fromMillis(Date.now() + STALE_GAME_THRESHOLD_MS);
}

async function joinAsBot(
  db: Firestore,
  uid: string,
  gameCode: string,
  name: string
): Promise<void> {
  const gameRef = doc(db, "games", gameCode);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error("Game not found.");
  if (gameSnap.data().status !== "lobby") {
    throw new Error("Game has already started — add bots before pressing Start.");
  }

  const playersCol = collection(db, "games", gameCode, "players");
  const playersSnap = await getDocs(playersCol);
  await setDoc(doc(playersCol, uid), {
    name,
    color: colorForJoinIndex(playersSnap.size),
    joinedAt: serverTimestamp(),
    isHost: false,
  });
}

async function maybeSubmitTurn(
  db: Firestore,
  uid: string,
  gameCode: string,
  turn: number,
  storyId: string
): Promise<void> {
  const gameRef = doc(db, "games", gameCode);
  const storyRef = doc(db, "games", gameCode, "stories", storyId);

  await runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef);
    const storySnap = await tx.get(storyRef);
    if (!gameSnap.exists() || !storySnap.exists()) return;

    const game = gameSnap.data();
    const story = storySnap.data();
    if (game.status !== "playing") return;
    if (game.currentTurn !== turn) return;
    if ((story.lastUpdatedTurn ?? 0) >= turn) return;

    const playerOrder: string[] = game.playerOrder ?? [];
    const finalTurn = isFinalTurn(turn, playerOrder.length, game.totalRounds);

    // Bot writes go through the EXACT validator a human submission does —
    // if this ever fails, the bot's word pool is the bug, not the bot.
    const text = randomSevenWords();
    const result = validateContribution({
      text,
      openSentenceOwner: story.openSentenceOwner ?? null,
      playerId: uid,
      isFinalRound: finalTurn,
    });
    if (!result.ok) {
      // Bots only ever produce plain terminal-free words, so reaching this
      // branch means the word pool needs a fix. Surface it loudly in dev.
      console.error("[bot] validation rejected bot contribution:", result.reason, text);
      return;
    }

    tx.update(storyRef, {
      contributions: [
        ...(story.contributions ?? []),
        { playerId: uid, text: text.trim(), turnNumber: turn },
      ],
      openSentenceOwner: result.newOpenOwner,
      lastUpdatedTurn: turn,
    });
    tx.update(gameRef, {
      lastActivityAt: serverTimestamp(),
      expiresAt: newExpiresAt(),
    });
  });
}

async function spawnBot(gameCode: string, name: string): Promise<Bot> {
  const appName = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const app = initializeApp(firebaseConfig, appName);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try {
      await deleteApp(app);
    } catch {
      // already gone — fine
    }
  };

  try {
    const cred = await signInAnonymously(auth);
    const uid = cred.user.uid;
    await joinAsBot(db, uid, gameCode, name);

    // Serialize submissions per bot so a burst of game-doc updates doesn't
    // race the same write twice. The transaction also guards against this,
    // but skipping the round-trip is nicer.
    let submitting: Promise<void> | null = null;
    const gameRef = doc(db, "games", gameCode);

    const unsub = onSnapshot(gameRef, (snap) => {
      if (!snap.exists()) return;
      const game = snap.data();
      if (game.status !== "playing") return;

      const playerOrder: string[] = game.playerOrder ?? [];
      const turn: number = game.currentTurn;
      if (playerOrder.length === 0 || turn < 1) return;

      let myStoryId: string | null = null;
      for (let i = 0; i < playerOrder.length; i++) {
        if (getStoryHolder(i, turn, playerOrder) === uid) {
          myStoryId = playerOrder[i];
          break;
        }
      }
      if (!myStoryId) return;

      if (submitting) return;
      submitting = maybeSubmitTurn(db, uid, gameCode, turn, myStoryId)
        .catch((err) => {
          console.error(`[bot ${name}] submit failed:`, err);
        })
        .finally(() => {
          submitting = null;
        });
    });

    return {
      uid,
      name,
      stop: async () => {
        unsub();
        await cleanup();
      },
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

export async function spawnTestBots(
  gameCode: string,
  count: number
): Promise<Bot[]> {
  const existing = activeBots.get(gameCode) ?? [];
  const fresh: Bot[] = [];
  for (let i = 0; i < count; i++) {
    const name = BOT_NAMES[(existing.length + i) % BOT_NAMES.length];
    const bot = await spawnBot(gameCode, name);
    fresh.push(bot);
  }
  activeBots.set(gameCode, [...existing, ...fresh]);
  return fresh;
}

export function getActiveTestBots(gameCode: string): readonly Bot[] {
  return activeBots.get(gameCode) ?? [];
}
