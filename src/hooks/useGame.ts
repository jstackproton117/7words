import { useEffect, useState } from "react";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { Game, GameStatus } from "../game/types";

export interface UseGameResult {
  game: Game | null;
  loading: boolean;
  error: Error | null;
}

export function useGame(code: string | undefined): UseGameResult {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!code) {
      setGame(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      doc(db, "games", code),
      (snap) => {
        setLoading(false);
        if (!snap.exists()) {
          setGame(null);
          return;
        }
        const data = snap.data();
        const createdAtRaw = data.createdAt;
        const createdAt =
          createdAtRaw instanceof Timestamp ? createdAtRaw.toDate() : null;
        const lastActivityAtRaw = data.lastActivityAt;
        const lastActivityAt =
          lastActivityAtRaw instanceof Timestamp
            ? lastActivityAtRaw.toDate()
            : null;
        setGame({
          code: snap.id,
          hostId: data.hostId,
          status: data.status as GameStatus,
          theme: data.theme ?? null,
          totalRounds: data.totalRounds,
          currentTurn: data.currentTurn,
          playerOrder: data.playerOrder ?? [],
          createdAt,
          lastActivityAt,
          nextGameCode: data.nextGameCode ?? null,
        });
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [code]);

  return { game, loading, error };
}
