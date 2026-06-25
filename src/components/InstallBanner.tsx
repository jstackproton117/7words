import { useEffect, useState } from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

const DISMISS_KEY = "seven.installBannerDismissed";

export function InstallBanner({ delayMs = 4000 }: { delayMs?: number }) {
  const { canPrompt, isIOS, installed, prompt } = useInstallPrompt();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (installed || dismissed) return;
    if (!canPrompt && !isIOS) return;
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [canPrompt, isIOS, installed, dismissed, delayMs]);

  if (installed || dismissed || !show) return null;
  if (!canPrompt && !isIOS) return null;

  const onDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode — fine, just keep it for this session.
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 p-4 z-50">
      <div className="max-w-md mx-auto bg-stone-900 text-stone-50 rounded-2xl shadow-lg p-5 flex flex-col gap-3">
        <div>
          <p className="text-lg font-semibold">Keep Seven on your phone</p>
          <p className="text-stone-300 text-base mt-1">
            {isIOS
              ? "Tap the Share button, then “Add to Home Screen” — it'll be easy to find next time."
              : "Add it to your home screen so it's easy to find next time."}
          </p>
        </div>
        <div className="flex gap-3">
          {canPrompt && (
            <button
              type="button"
              onClick={async () => {
                await prompt();
                onDismiss();
              }}
              className="flex-1 min-h-[56px] bg-stone-50 text-stone-900 rounded-xl text-lg font-semibold"
            >
              Add to home screen
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className={`min-h-[56px] px-5 rounded-xl text-lg ${
              canPrompt
                ? "bg-stone-700 text-stone-50"
                : "flex-1 bg-stone-50 text-stone-900 font-semibold"
            }`}
          >
            {canPrompt ? "Not now" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}
