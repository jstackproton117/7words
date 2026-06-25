import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { usePlayers } from "../hooks/usePlayers";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  cancelGame,
  cleanupStaleGame,
  leaveLobby,
  renameSelf,
  startGame,
} from "../game/mutations";
import { STALE_GAME_THRESHOLD_MS, type Player } from "../game/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TipRotation } from "../components/TipRotation";
import { TIPS } from "../game/tips";

const MIN_PLAYERS = 3;

export function Lobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { game, loading: gameLoading } = useGame(code);
  const { players } = usePlayers(code);

  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!game || !code) return;
    if (game.status === "playing") {
      navigate(`/game/${code}/play`, { replace: true });
    } else if (game.status === "reveal") {
      navigate(`/game/${code}/reveal`, { replace: true });
    }
  }, [game, code, navigate]);

  // Auto-cleanup a game that has gone 30+ minutes without any activity.
  useEffect(() => {
    if (!code || !game) return;
    if (!game.lastActivityAt) return;
    const last = game.lastActivityAt;
    const check = () => {
      if (Date.now() - last.getTime() > STALE_GAME_THRESHOLD_MS) {
        void cleanupStaleGame(code).catch(() => {
          // Another client may have already cleaned up — ignore.
        });
      }
    };
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [code, game]);

  if (gameLoading) {
    return <CenterMessage>Loading…</CenterMessage>;
  }
  if (!game) {
    return (
      <CenterMessage>
        We couldn't find that game.
        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="mt-6 min-h-[56px] px-6 text-xl font-semibold bg-stone-900 text-stone-50 rounded-xl"
        >
          Back to home
        </button>
      </CenterMessage>
    );
  }

  const isHost = user?.uid === game.hostId;
  const canStart = players.length >= MIN_PLAYERS;

  const shareLink = `${window.location.origin}/join/${game.code}`;

  const onShare = async () => {
    const shareData = {
      title: "Seven",
      text: `Join my Seven game — code ${game.code}.`,
      url: shareLink,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled — fall through to clipboard fallback.
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareLink);
        setError(null);
        alert("Link copied — paste it anywhere.");
      } catch {
        setError("Couldn't copy automatically — share the code instead.");
      }
    }
  };

  const onStart = async () => {
    if (starting || !canStart || !code) return;
    setStarting(true);
    setError(null);
    try {
      await startGame(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the game.");
      setStarting(false);
    }
  };

  const onCancelGame = () => {
    if (!code || leaving) return;
    setCancelConfirmOpen(true);
  };

  const doCancelGame = async () => {
    setCancelConfirmOpen(false);
    if (!code) return;
    setLeaving(true);
    setError(null);
    try {
      await cancelGame(code);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel the game.");
      setLeaving(false);
    }
  };

  const onLeaveGame = async () => {
    if (!code || leaving) return;
    setLeaving(true);
    setError(null);
    try {
      await leaveLobby(code);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't leave the game.");
      setLeaving(false);
    }
  };

  return (
    <main className="min-h-full bg-stone-50 text-stone-900 flex flex-col p-6 gap-6 max-w-md mx-auto w-full">
      <section className="text-center pt-4">
        <p className="text-lg text-stone-600">Game code</p>
        <p
          className="text-7xl font-bold tracking-[0.3em] mt-2"
          aria-label={`Game code ${game.code.split("").join(" ")}`}
        >
          {game.code}
        </p>
        {game.theme && (
          <p className="text-stone-600 text-lg mt-3">Theme: {game.theme}</p>
        )}
      </section>

      <button
        type="button"
        onClick={onShare}
        className="min-h-[56px] text-xl font-semibold bg-stone-200 text-stone-900 rounded-xl active:scale-[0.98] transition"
      >
        Share invite
      </button>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-stone-700">
          Players ({players.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              isMe={p.id === user?.uid}
              gameCode={code ?? ""}
            />
          ))}
        </ul>
      </section>

      <TipRotation tips={TIPS} />

      {error && (
        <p role="alert" className="text-rose-700 text-lg">
          {error}
        </p>
      )}

      {isHost ? (
        <>
          <button
            type="button"
            onClick={onStart}
            disabled={starting || !canStart}
            className="min-h-[72px] text-2xl font-semibold bg-stone-900 text-stone-50 rounded-2xl px-8 shadow-sm active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100"
          >
            {starting ? "Starting…" : "Start Game"}
          </button>
          {!canStart && (
            <p className="text-center text-stone-600">
              {MIN_PLAYERS - players.length} more{" "}
              {MIN_PLAYERS - players.length === 1 ? "player" : "players"} needed
              to start.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-center text-stone-600 text-lg">
            Waiting for the host to start…
          </p>
          {!canStart && (
            <p className="text-center text-stone-500 text-base">
              {MIN_PLAYERS - players.length} more{" "}
              {MIN_PLAYERS - players.length === 1 ? "player" : "players"} needed
              before we can start.
            </p>
          )}
        </>
      )}

      <div className="pt-4 pb-2 text-center">
        {isHost ? (
          <button
            type="button"
            onClick={onCancelGame}
            disabled={leaving}
            className="text-stone-700 underline text-base min-h-[56px] px-4 py-2"
          >
            {leaving ? "Cancelling…" : "Cancel game"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeaveGame}
            disabled={leaving}
            className="text-stone-700 underline text-base min-h-[56px] px-4 py-2"
          >
            {leaving ? "Leaving…" : "Leave game"}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancel this game?"
        message="Everyone will be sent back to the home screen and any in-progress story will be lost."
        confirmLabel="Yes, cancel"
        cancelLabel="Keep going"
        destructive
        onConfirm={doCancelGame}
        onCancel={() => setCancelConfirmOpen(false)}
      />
    </main>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-full bg-stone-50 text-stone-900 flex flex-col items-center justify-center p-6 text-xl text-center">
      {children}
    </main>
  );
}

function PlayerRow({
  player,
  isMe,
  gameCode,
}: {
  player: Player;
  isMe: boolean;
  gameCode: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the draft in sync if Firestore pushes a name update from elsewhere.
  useEffect(() => {
    if (!editing) setDraft(player.name);
  }, [player.name, editing]);

  const startEdit = () => {
    setDraft(player.name);
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(player.name);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    if (trimmed === player.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await renameSelf(gameCode, trimmed);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-2 bg-white rounded-xl p-3 border-2 border-stone-900">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: player.color }}
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="flex-1 min-h-[48px] text-xl px-3 rounded-lg border-2 border-stone-300 focus:border-stone-900 focus:outline-none bg-white"
            placeholder="Your name"
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") cancelEdit();
            }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || draft.trim() === ""}
            className="flex-1 min-h-[48px] bg-stone-900 text-stone-50 rounded-lg text-lg font-semibold disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="min-h-[48px] px-5 bg-stone-200 text-stone-900 rounded-lg text-lg"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p role="alert" className="text-rose-700 text-base">
            {error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 bg-white rounded-xl p-4 border border-stone-200">
      <span
        aria-hidden
        className="inline-block w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: player.color }}
      />
      <span className="text-xl font-medium flex-1">
        {player.name}
        {isMe && <span className="text-stone-500 text-base"> (you)</span>}
      </span>
      {player.isHost && (
        <span className="text-stone-500 text-base">host</span>
      )}
      {isMe && (
        <button
          type="button"
          onClick={startEdit}
          className="ml-2 min-h-[44px] px-3 text-base font-medium text-stone-700 bg-stone-100 rounded-lg"
          aria-label="Edit your name"
        >
          Edit
        </button>
      )}
    </li>
  );
}
