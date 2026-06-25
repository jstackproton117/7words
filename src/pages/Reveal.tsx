import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { useStories } from "../hooks/useStories";
import { usePlayers } from "../hooks/usePlayers";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { StoryBody } from "../components/StoryBody";
import { InstallBanner } from "../components/InstallBanner";
import type { Player, Story } from "../game/types";
import { startNextGame, submitQuip, toggleHeart } from "../game/mutations";
import { pickQuip } from "../game/quips";

const TIP_URL = import.meta.env.VITE_TIP_URL as string | undefined;

export function Reveal() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { game, loading: gameLoading } = useGame(code);
  const { stories } = useStories(code);
  const { players } = usePlayers(code);

  useEffect(() => {
    if (gameLoading) return;
    if (!game) {
      navigate("/", { replace: true });
    }
  }, [game, gameLoading, navigate]);

  const orderedStories = useMemo(() => {
    if (!game) return stories;
    const byId = new Map(stories.map((s) => [s.id, s]));
    return game.playerOrder
      .map((pid) => byId.get(pid))
      .filter((s): s is Story => !!s);
  }, [game, stories]);

  if (gameLoading || !game || !user) {
    return (
      <main className="min-h-full bg-stone-50 text-stone-900 flex items-center justify-center text-xl">
        Loading…
      </main>
    );
  }

  const isHost = user.uid === game.hostId;

  return (
    <main className="min-h-full bg-stone-50 text-stone-900 flex flex-col">
      <header className="px-6 pt-6 pb-2 text-center">
        <h1 className="text-3xl font-bold">Story time</h1>
        {game.theme && (
          <p className="text-stone-600 text-lg mt-1">{game.theme}</p>
        )}
        <p className="text-stone-500 text-sm mt-1">
          {orderedStories.length} stor{orderedStories.length === 1 ? "y" : "ies"}{" "}
          · swipe to read
        </p>
      </header>

      <div
        className="flex-1 overflow-x-auto snap-x snap-mandatory flex"
        style={{ scrollbarWidth: "none" }}
      >
        {orderedStories.map((s) => (
          <StoryCard
            key={s.id}
            story={s}
            players={players}
            theme={game.theme}
            code={code!}
            userId={user.uid}
          />
        ))}
      </div>

      <div className="px-6 py-4 flex flex-col gap-3">
        <PlayAgainSection
          isHost={isHost}
          nextGameCode={game.nextGameCode}
          code={code!}
        />
        <TipSection />
        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="w-full min-h-[56px] text-xl font-semibold bg-stone-200 text-stone-900 rounded-xl active:scale-[0.98] transition"
        >
          Back to home
        </button>
      </div>

      <InstallBanner />
    </main>
  );
}

function StoryCard({
  story,
  players,
  theme,
  code,
  userId,
}: {
  story: Story;
  players: Player[];
  theme: string | null;
  code: string;
  userId: string;
}) {
  const contributors = useMemo(() => {
    const seen = new Set<string>();
    const list: Player[] = [];
    for (const c of story.contributions) {
      if (seen.has(c.playerId)) continue;
      seen.add(c.playerId);
      const p = players.find((pp) => pp.id === c.playerId);
      if (p) list.push(p);
    }
    return list;
  }, [story, players]);

  const [shareError, setShareError] = useState<string | null>(null);
  const [heartPending, setHeartPending] = useState(false);

  const heartCount = Object.keys(story.hearts).length;
  const iHearted = !!story.hearts[userId];

  const buildShareText = (): string => {
    const body = story.contributions.map((c) => c.text).join(" ");
    const header = theme ? `${theme}\n\n` : "";
    return `${header}${body}\n\n— from Seven`;
  };

  const onShare = async () => {
    setShareError(null);
    const text = buildShareText();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Our story", text });
        return;
      } catch {
        // User cancelled — fall through.
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        alert("Story copied — paste it anywhere.");
        return;
      } catch {
        setShareError("Couldn't copy automatically.");
      }
    } else {
      setShareError("Sharing isn't available on this device.");
    }
  };

  const onHeart = async () => {
    if (heartPending) return;
    setHeartPending(true);
    try {
      await toggleHeart(code, story.id);
    } catch {
      // Best-effort — ignore. Listener will resync if it landed.
    } finally {
      setHeartPending(false);
    }
  };

  return (
    <article className="snap-center shrink-0 w-full max-w-md mx-auto px-6 py-4 flex flex-col gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex-1 flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {contributors.map((p) => (
            <span
              key={p.id}
              className="text-base font-semibold"
              style={{ color: p.color }}
            >
              {p.name}
            </span>
          ))}
        </div>
        <StoryBody
          story={story}
          players={players}
          emptyMessage="This story is empty."
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onHeart}
          disabled={heartPending}
          aria-pressed={iHearted}
          aria-label={iHearted ? "Remove heart" : "Heart this story"}
          className={`min-h-[56px] px-5 rounded-xl text-xl font-semibold active:scale-[0.98] transition border-2 ${
            iHearted
              ? "bg-rose-100 text-rose-700 border-rose-300"
              : "bg-white text-stone-700 border-stone-300"
          }`}
        >
          {iHearted ? "♥" : "♡"}
          {heartCount > 0 && (
            <span className="ml-2 text-base font-medium">{heartCount}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex-1 min-h-[56px] text-xl font-semibold bg-stone-900 text-stone-50 rounded-xl active:scale-[0.98] transition"
        >
          Share
        </button>
      </div>
      {shareError && (
        <p role="alert" className="text-rose-700 text-base text-center">
          {shareError}
        </p>
      )}
    </article>
  );
}

function PlayAgainSection({
  isHost,
  nextGameCode,
  code,
}: {
  isHost: boolean;
  nextGameCode: string | null;
  code: string;
}) {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onHostStart = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const newCode = await startNextGame(code);
      navigate(`/game/${newCode}/lobby`, { replace: true });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't start a new game."
      );
      setStarting(false);
    }
  };

  if (isHost) {
    return (
      <>
        <button
          type="button"
          onClick={onHostStart}
          disabled={starting}
          className="w-full min-h-[56px] text-xl font-semibold bg-stone-900 text-stone-50 rounded-xl active:scale-[0.98] transition disabled:opacity-40"
        >
          {nextGameCode
            ? "Open the next game"
            : starting
            ? "Starting…"
            : "Play again"}
        </button>
        {error && (
          <p role="alert" className="text-rose-700 text-base text-center">
            {error}
          </p>
        )}
      </>
    );
  }

  if (nextGameCode) {
    return (
      <button
        type="button"
        onClick={() => navigate(`/join/${nextGameCode}`)}
        className="w-full min-h-[56px] text-xl font-semibold bg-stone-900 text-stone-50 rounded-xl active:scale-[0.98] transition"
      >
        Join the next game
      </button>
    );
  }

  return null;
}

function TipSection() {
  // Pick once per mount so the quip doesn't flicker between renders.
  const [quip] = useState(() => pickQuip());
  const [tipped, setTipped] = useState(false);

  if (!TIP_URL) return null;

  return (
    <section className="flex flex-col gap-2 items-center pt-2">
      <a
        href={TIP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setTipped(true)}
        className="text-stone-600 text-sm text-center underline underline-offset-4"
      >
        {quip}
      </a>
      {tipped && <QuipFeedbackForm />}
    </section>
  );
}

function QuipFeedbackForm() {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitQuip({ text, name });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't send — try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <p className="text-stone-500 text-sm text-center">
        Got it — thanks. We'll read it.
      </p>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2 bg-white border border-stone-200 rounded-xl p-3">
      <p className="text-stone-700 text-sm">
        Got a quip? If it's funny enough we'll add it to the game. Keep it
        short.
      </p>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={100}
        placeholder="Your quip (100 chars max)"
        className="min-h-[44px] px-3 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none bg-white text-base"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="Add your name? (optional)"
        className="min-h-[44px] px-3 rounded-lg border border-stone-300 focus:border-stone-900 focus:outline-none bg-white text-base"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || text.trim() === ""}
          className="flex-1 min-h-[44px] bg-stone-900 text-stone-50 rounded-lg text-base font-semibold disabled:opacity-40"
        >
          {submitting ? "Sending…" : "Send"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-rose-700 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
