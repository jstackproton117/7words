import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { Contribution, Story } from "../game/types";

export interface UseStoriesResult {
  stories: Story[];
  loading: boolean;
  error: Error | null;
}

export function useStories(code: string | undefined): UseStoriesResult {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!code) {
      setStories([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      collection(db, "games", code, "stories"),
      (snap) => {
        const list: Story[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            contributions: (data.contributions ?? []) as Contribution[],
            openSentenceOwner: data.openSentenceOwner ?? null,
            lastUpdatedTurn: data.lastUpdatedTurn ?? 0,
            hearts: (data.hearts ?? {}) as Record<string, true>,
          };
        });
        setStories(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [code]);

  return { stories, loading, error };
}
