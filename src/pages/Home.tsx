import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function Home() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <main className="min-h-full bg-stone-50 text-stone-900 flex flex-col items-center justify-center p-6 gap-5">
      <header className="text-center mb-6">
        <h1 className="text-6xl font-bold tracking-tight">Seven</h1>
        <p className="text-lg text-stone-600 mt-3 max-w-sm mx-auto">
          A storytelling game. Everyone writes seven words at a time.
        </p>
      </header>

      <Link
        to="/create"
        className="w-full max-w-md min-h-[72px] flex items-center justify-center text-2xl font-semibold bg-stone-900 text-stone-50 rounded-2xl px-8 shadow-sm active:scale-[0.98] transition"
      >
        Start a Game
      </Link>

      <Link
        to="/join"
        className="w-full max-w-md min-h-[72px] flex items-center justify-center text-2xl font-semibold bg-stone-200 text-stone-900 rounded-2xl px-8 active:scale-[0.98] transition"
      >
        Join a Game
      </Link>

      <button
        type="button"
        onClick={() => setAboutOpen(true)}
        aria-label="About this game"
        className="mt-6 text-stone-600 underline text-base min-h-[44px] px-4"
      >
        About
      </button>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}

function formatBuildTime(iso: string): string {
  try {
    const d = new Date(iso);
    // YYYY-MM-DD HH:mm UTC
    const pad = (n: number) => n.toString().padStart(2, "0");
    return (
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
      ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
    );
  } catch {
    return iso;
  }
}

function AboutDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="about-title" className="text-2xl font-bold text-stone-900">
          About Seven
        </h2>
        <p className="text-lg text-stone-700 leading-relaxed">
          Game created by <strong>Steven Sneed</strong> and{" "}
          <strong>Peter Olson</strong>.
        </p>
        <p className="text-lg text-stone-700 leading-relaxed">
          Code written by <strong>Joseph Stackpole</strong> with Claude.ai.
        </p>
        <p className="text-xs text-stone-400 mt-1">
          Build {formatBuildTime(__BUILD_TIME__)}
        </p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="min-h-[56px] text-xl font-semibold bg-stone-900 text-stone-50 rounded-xl active:scale-[0.98] transition mt-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}
