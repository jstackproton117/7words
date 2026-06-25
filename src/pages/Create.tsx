import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createGame } from "../game/mutations";
import { sampleThemes } from "../game/themes";

export function Create() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState<2 | 3>(2);
  const [theme, setTheme] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Re-randomized each time the Create screen mounts.
  const [themeSuggestions] = useState(() => sampleThemes(5));

  const onCreate = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const code = await createGame({
        hostName: name,
        totalRounds: rounds,
        theme: theme.trim() || null,
      });
      navigate(`/game/${code}/lobby`, { replace: true });
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

      <h1 className="text-4xl font-bold">Start a game</h1>

      <label className="flex flex-col gap-2">
        <span className="text-lg font-medium">Your name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          autoFocus
          className="min-h-[56px] text-xl px-4 rounded-xl border-2 border-stone-300 focus:border-stone-900 focus:outline-none bg-white"
          placeholder="e.g. Grandma"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-lg font-medium mb-2">Rounds</legend>
        <div className="flex gap-3">
          {[2, 3].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRounds(r as 2 | 3)}
              className={`flex-1 min-h-[64px] text-2xl font-semibold rounded-xl border-2 transition ${
                rounds === r
                  ? "bg-stone-900 text-stone-50 border-stone-900"
                  : "bg-white text-stone-900 border-stone-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-sm text-stone-500">
          {rounds === 2
            ? "Each story gets two passes around the group."
            : "Each story gets three passes — longer game, fuller stories."}
        </p>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-lg font-medium">
          Theme <span className="text-stone-500 font-normal">(optional)</span>
        </span>
        <input
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="min-h-[56px] text-xl px-4 rounded-xl border-2 border-stone-300 focus:border-stone-900 focus:outline-none bg-white"
          placeholder="e.g. A summer at the lake"
        />
        <div className="flex flex-wrap gap-2 pt-1" aria-label="Theme suggestions">
          {themeSuggestions.map((s) => {
            const selected = theme.trim() === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setTheme(s)}
                aria-pressed={selected}
                className={`min-h-[44px] px-4 text-base rounded-full border transition active:scale-[0.98] ${
                  selected
                    ? "bg-stone-900 text-stone-50 border-stone-900"
                    : "bg-white text-stone-800 border-stone-300"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </label>

      {error && (
        <p role="alert" className="text-rose-700 text-lg">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onCreate}
        disabled={submitting || name.trim() === ""}
        className="min-h-[72px] text-2xl font-semibold bg-stone-900 text-stone-50 rounded-2xl px-8 shadow-sm active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100"
      >
        {submitting ? "Creating…" : "Create Game"}
      </button>
    </main>
  );
}
