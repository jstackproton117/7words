import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { joinGame } from "../game/mutations";
import { isValidGameCodeShape, normalizeGameCode } from "../game/codes";

export function Join() {
  const navigate = useNavigate();
  const { code: routeCode } = useParams<{ code: string }>();
  const [code, setCode] = useState(routeCode ? normalizeGameCode(routeCode) : "");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (routeCode) setCode(normalizeGameCode(routeCode));
  }, [routeCode]);

  const codeReady = isValidGameCodeShape(code);
  const nameReady = name.trim().length > 0;

  const onJoin = async () => {
    if (submitting || !codeReady || !nameReady) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await joinGame(code, name);
      navigate(`/game/${result.code}/lobby`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-full bg-stone-50 text-stone-900 flex flex-col p-6 gap-6 max-w-md mx-auto w-full">
      <Link to="/" className="text-stone-600 text-lg">
        ← Back
      </Link>

      <h1 className="text-4xl font-bold">Join a game</h1>

      <label className="flex flex-col gap-2">
        <span className="text-lg font-medium">Game code</span>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(normalizeGameCode(e.target.value))}
          maxLength={4}
          autoFocus
          className="min-h-[80px] text-5xl font-bold text-center tracking-[0.4em] px-4 rounded-xl border-2 border-stone-300 focus:border-stone-900 focus:outline-none bg-white uppercase"
          placeholder="ABCD"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-lg font-medium">Your name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          className="min-h-[56px] text-xl px-4 rounded-xl border-2 border-stone-300 focus:border-stone-900 focus:outline-none bg-white"
          placeholder="e.g. Sam"
        />
      </label>

      {error && (
        <p role="alert" className="text-rose-700 text-lg">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onJoin}
        disabled={submitting || !codeReady || !nameReady}
        className="min-h-[72px] text-2xl font-semibold bg-stone-900 text-stone-50 rounded-2xl px-8 shadow-sm active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100"
      >
        {submitting ? "Joining…" : "Join Game"}
      </button>
    </main>
  );
}
