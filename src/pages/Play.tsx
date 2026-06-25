import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { useStories } from "../hooks/useStories";
import { usePlayers } from "../hooks/usePlayers";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  advanceTurnIfReady,
  cancelGame,
  cleanupStaleGame,
  skipPlayer,
  submitContribution,
} from "../game/mutations";
import { STALE_GAME_THRESHOLD_MS } from "../game/types";
import {
  getRound,
  getStoryHolderIndex,
  isFinalTurn,
} from "../game/rotation";
import { validateContribution } from "../game/validation";
import type { Game, Player, Story } from "../game/types";
import { StoryBody } from "../components/StoryBody";
import { WordDots } from "../components/WordDots";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TipRotation } from "../components/TipRotation";
import { TIPS } from "../game/tips";
import { RuleCard } from "../components/RuleCard";
import { RoundIndicator } from "../components/RoundIndicator";

export function Play() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { game, loading: gameLoading } = useGame(code);
  const { stories } = useStories(code);
  const { players } = usePlayers(code);

  useEffect(() => {
    if (gameLoading) return;
    if (!code) return;
    if (!game) {
      // Game doc disappeared (host cancelled, etc.) — send everyone home.
      navigate("/", { replace: true });
      return;
    }
    if (game.status === "lobby") {
      navigate(`/game/${code}/lobby`, { replace: true });
    } else if (game.status === "reveal") {
      navigate(`/game/${code}/reveal`, { replace: true });
    }
  }, [game, gameLoading, code, navigate]);

  // If every story has been written for the current turn, nudge the turn forward.
  // Transactional + idempotent, so it's safe for multiple clients to call.
  useEffect(() => {
    if (!code || !game || game.status !== "playing") return;
    if (game.playerOrder.length === 0) return;
    if (stories.length !== game.playerOrder.length) return;
    const allWritten = stories.every(
      (s) => s.lastUpdatedTurn >= game.currentTurn
    );
    if (allWritten) {
      void advanceTurnIfReady(code);
    }
  }, [code, game, stories]);

  // Auto-cleanup a game with no activity for 30+ minutes. Any connected
  // client may trigger this; the rule + mutation both verify staleness.
  useEffect(() => {
    if (!code || !game) return;
    if (game.status === "reveal") return;
    if (!game.lastActivityAt) return;

    const lastActivity = game.lastActivityAt;
    const check = () => {
      if (Date.now() - lastActivity.getTime() > STALE_GAME_THRESHOLD_MS) {
        void cleanupStaleGame(code).catch(() => {
          // Another client may have already cleaned up — ignore.
        });
      }
    };
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [code, game]);

  const myStory: Story | null = useMemo(() => {
    if (!game || !user) return null;
    const playerCount = game.playerOrder.length;
    if (playerCount === 0) return null;
    for (let storyIdx = 0; storyIdx < playerCount; storyIdx++) {
      const holderIdx = getStoryHolderIndex(
        storyIdx,
        game.currentTurn,
        playerCount
      );
      if (game.playerOrder[holderIdx] === user.uid) {
        const storyId = game.playerOrder[storyIdx];
        return stories.find((s) => s.id === storyId) ?? null;
      }
    }
    return null;
  }, [game, stories, user]);

  // Brief "stories are rotating" overlay shown after the local player submits,
  // bridging the gap between their write screen and whatever comes next.
  // Players already on the waiting screen never trigger it.
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  useEffect(() => {
    if (submittedAt === null) return;
    const id = window.setTimeout(() => setSubmittedAt(null), 900);
    return () => window.clearTimeout(id);
  }, [submittedAt]);

  if (gameLoading || !game || !user) {
    return (
      <main className="min-h-full bg-stone-50 text-stone-900 flex items-center justify-center text-xl">
        Loading…
      </main>
    );
  }

  if (submittedAt !== null) {
    return <RotationOverlay />;
  }

  const alreadyWrote =
    myStory != null && myStory.lastUpdatedTurn >= game.currentTurn;

  if (!myStory || alreadyWrote) {
    return (
      <WaitingScreen
        game={game}
        stories={stories}
        players={players}
        userId={user.uid}
        code={code!}
      />
    );
  }

  return (
    <WriteScreen
      game={game}
      story={myStory}
      players={players}
      userId={user.uid}
      code={code!}
      onSubmitted={() => setSubmittedAt(Date.now())}
    />
  );
}

function RotationOverlay() {
  return (
    <main className="min-h-full bg-stone-50 text-stone-900 flex flex-col items-center justify-center gap-6 p-6">
      <p className="text-2xl font-semibold text-center tip-fade">
        Stories are rotating…
      </p>
      <div className="flex items-center gap-2" aria-hidden>
        <span className="waiting-dot w-3 h-3 bg-stone-700 rounded-full" />
        <span className="waiting-dot w-3 h-3 bg-stone-700 rounded-full" />
        <span className="waiting-dot w-3 h-3 bg-stone-700 rounded-full" />
      </div>
    </main>
  );
}

function WaitingScreen({
  game,
  stories,
  players,
  userId,
  code,
}: {
  game: Game;
  stories: Story[];
  players: Player[];
  userId: string;
  code: string;
}) {
  const isHost = userId === game.hostId;

  const pending = useMemo(() => {
    const list: { playerId: string; storyId: string; name: string }[] = [];
    for (let i = 0; i < game.playerOrder.length; i++) {
      const storyId = game.playerOrder[i];
      const story = stories.find((s) => s.id === storyId);
      if (!story) continue;
      if (story.lastUpdatedTurn >= game.currentTurn) continue;
      const holderIdx = getStoryHolderIndex(
        i,
        game.currentTurn,
        game.playerOrder.length
      );
      const holder = game.playerOrder[holderIdx];
      const name = players.find((p) => p.id === holder)?.name ?? "Someone";
      list.push({ playerId: holder, storyId, name });
    }
    return list;
  }, [game, stories, players]);

  const otherPending = pending.filter((p) => p.playerId !== userId);
  const playerCount = game.playerOrder.length;
  const finalTurn = isFinalTurn(
    game.currentTurn,
    playerCount,
    game.totalRounds
  );
  const round = getRound(game.currentTurn, playerCount);

  const label =
    otherPending.length === 0
      ? finalTurn
        ? "Wrapping things up…"
        : "Wrapping up the round…"
      : otherPending.length === 1
      ? `Waiting for ${otherPending[0].name}…`
      : `Waiting for ${otherPending
          .slice(0, -1)
          .map((p) => p.name)
          .join(", ")} and ${otherPending[otherPending.length - 1].name}…`;

  return (
    <main className="min-h-full bg-stone-50 text-stone-900 flex flex-col p-6 gap-6 max-w-md mx-auto w-full">
      <h2 className="text-3xl font-semibold text-center pt-4">{label}</h2>
      <div className="flex items-center justify-center gap-2" aria-hidden>
        <span className="waiting-dot w-3 h-3 bg-stone-700 rounded-full" />
        <span className="waiting-dot w-3 h-3 bg-stone-700 rounded-full" />
        <span className="waiting-dot w-3 h-3 bg-stone-700 rounded-full" />
      </div>
      {!finalTurn && (
        <RoundIndicator round={round} totalRounds={game.totalRounds} />
      )}
      {finalTurn ? (
        <section className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
          <p className="text-amber-900 font-semibold text-lg">
            Final touch
          </p>
          <p className="text-amber-900 text-base mt-1">
            Everyone is privately closing out their own story with up to 14
            words. Reveal is right after.
          </p>
        </section>
      ) : (
        <RuleCard
          finalRound={false}
          round={round}
          totalRounds={game.totalRounds}
        />
      )}
      <TipRotation tips={TIPS} />
      {isHost && otherPending.length > 0 && (
        <section className="flex flex-col gap-2 w-full">
          <p className="text-stone-600 text-sm text-center">
            Stuck? Skip a player and keep going.
          </p>
          {otherPending.map((p) => (
            <SkipPlayerButton
              key={p.storyId}
              code={code}
              storyId={p.storyId}
              name={p.name}
            />
          ))}
        </section>
      )}
      {isHost && <CancelGameLink code={code} />}
    </main>
  );
}

function SkipPlayerButton({
  code,
  storyId,
  name,
}: {
  code: string;
  storyId: string;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSkip = async () => {
    setConfirming(false);
    setSkipping(true);
    setError(null);
    try {
      await skipPlayer(code, storyId);
      await advanceTurnIfReady(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't skip.");
    } finally {
      setSkipping(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={skipping}
        className="min-h-[56px] text-lg font-medium bg-stone-200 text-stone-900 rounded-xl px-4 active:scale-[0.98] transition disabled:opacity-40"
      >
        {skipping ? "Skipping…" : `Skip ${name}'s turn`}
      </button>
      {error && (
        <p role="alert" className="text-rose-700 text-base text-center">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title={`Skip ${name}?`}
        message={`${name}'s contribution for this turn will be marked “(skipped)” and the game will keep going. They can still write on later turns.`}
        confirmLabel="Yes, skip"
        cancelLabel="Keep waiting"
        onConfirm={doSkip}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

function WriteScreen({
  game,
  story,
  players,
  userId,
  code,
  onSubmitted,
}: {
  game: Game;
  story: Story;
  players: Player[];
  userId: string;
  code: string;
  onSubmitted: () => void;
}) {
  const playerCount = game.playerOrder.length;
  // Relaxed 1–14 word limits only fire on the single private finishing turn.
  // The rotation puts each player on their own story there, so `story.id`
  // will always equal `userId` when this is true.
  const finalRound = isFinalTurn(
    game.currentTurn,
    playerCount,
    game.totalRounds
  );
  const round = getRound(game.currentTurn, playerCount);
  const isHost = userId === game.hostId;

  const draftKey = `seven.draft.${code}.${story.id}.${game.currentTurn}`;
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // On turn change, load whatever draft is saved for this turn (or "").
  useEffect(() => {
    let stored = "";
    try {
      stored = localStorage.getItem(draftKey) ?? "";
    } catch {
      // private mode — fine
    }
    setText(stored);
    setSubmitError(null);
  }, [draftKey]);

  // Save the draft as it changes so a refresh/PWA-update doesn't lose it.
  useEffect(() => {
    try {
      if (text) {
        localStorage.setItem(draftKey, text);
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {
      // quota / private mode — fine
    }
  }, [text, draftKey]);

  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const targetWords = finalRound ? null : 7;
  const maxDots = finalRound ? 14 : 7;

  const liveValidation = useMemo(() => {
    if (text.trim() === "") return null;
    return validateContribution({
      text,
      openSentenceOwner: story.openSentenceOwner,
      playerId: userId,
      isFinalRound: finalRound,
    });
  }, [text, story.openSentenceOwner, userId, finalRound]);

  const canSubmit =
    !submitting && liveValidation !== null && liveValidation.ok === true;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitContribution({ code, storyId: story.id, text });
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      onSubmitted();
      await advanceTurnIfReady(code);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Couldn't send — try again."
      );
      setSubmitting(false);
    }
  };

  const validationMessage =
    liveValidation && !liveValidation.ok && wordCount > 0
      ? liveValidation.reason
      : null;

  return (
    <main className="min-h-full bg-stone-50 text-stone-900 flex flex-col p-6 gap-5 max-w-md mx-auto w-full">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">
          {finalRound ? "Finish your story!" : "Your turn!"}
        </h1>
        <span className="text-stone-500 text-base">
          {finalRound ? "Final touch" : `Round ${round} of ${game.totalRounds}`}
        </span>
      </header>

      {game.theme && (
        <p className="text-stone-600 text-base">
          <span className="font-medium text-stone-700">Theme:</span> {game.theme}
        </p>
      )}

      <section
        className="bg-white rounded-2xl border border-stone-200 p-4 min-h-[120px]"
        aria-label="Story so far"
      >
        <StoryBody
          story={story}
          players={players}
          emptyMessage="You're starting this one — write the opening seven words."
        />
      </section>

      <RuleCard
        finalRound={finalRound}
        round={round}
        totalRounds={game.totalRounds}
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
        inputMode="text"
        autoCapitalize="sentences"
        className="text-xl p-4 rounded-2xl border-2 border-stone-300 focus:border-stone-900 focus:outline-none bg-white resize-none leading-relaxed min-h-[112px]"
        placeholder={
          finalRound
            ? "Add 1 to 14 words — and you can finish sentences."
            : "Add exactly 7 words…"
        }
      />

      <WordDots count={wordCount} max={maxDots} target={targetWords ?? undefined} />

      <p className="text-sm text-stone-500 text-center min-h-[1.25rem]">
        {finalRound
          ? `${wordCount} word${wordCount === 1 ? "" : "s"} (1–14 allowed)`
          : `${wordCount} of 7 words`}
      </p>

      {validationMessage && (
        <p role="alert" className="text-rose-700 text-lg text-center">
          {validationMessage}
        </p>
      )}

      {submitError && (
        <p role="alert" className="text-rose-700 text-lg text-center">
          {submitError}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="min-h-[72px] text-2xl font-semibold bg-stone-900 text-stone-50 rounded-2xl shadow-sm active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100"
      >
        {submitting ? "Sending…" : finalRound ? "Send (final)" : "Send"}
      </button>
      {isHost && <CancelGameLink code={code} />}
    </main>
  );
}

function CancelGameLink({ code }: { code: string }) {
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (cancelling) return;
    setConfirmOpen(true);
  };

  const doCancel = async () => {
    setConfirmOpen(false);
    setCancelling(true);
    setError(null);
    try {
      await cancelGame(code);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel the game.");
      setCancelling(false);
    }
  };

  return (
    <div className="text-center pt-2">
      <button
        type="button"
        onClick={onClick}
        disabled={cancelling}
        className="text-stone-700 underline text-base min-h-[56px] px-4 py-2"
      >
        {cancelling ? "Cancelling…" : "Cancel game"}
      </button>
      {error && (
        <p role="alert" className="text-rose-700 text-base mt-2">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="Cancel this game?"
        message="Everyone will be sent home and the story will be lost."
        confirmLabel="Yes, cancel"
        cancelLabel="Keep playing"
        destructive
        onConfirm={doCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
