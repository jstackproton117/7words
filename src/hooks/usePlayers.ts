import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Player } from "../game/types";

export interface UsePlayersResult {
  players: Player[];
  loading: boolean;
  error: Error | null;
}

export function usePlayers(code: string | undefined): UsePlayersResult {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!code) {
      setPlayers([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const q = query(
      collection(db, "games", code, "players"),
      orderBy("joinedAt")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Player[] = snap.docs.map((d) => {
          const data = d.data();
          const joinedAtRaw = data.joinedAt;
          const joinedAt =
            joinedAtRaw instanceof Timestamp ? joinedAtRaw.toDate() : null;
          return {
            id: d.id,
            name: data.name,
            color: data.color,
            joinedAt,
            isHost: !!data.isHost,
          };
        });
        setPlayers(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [code]);

  return { players, loading, error };
}
