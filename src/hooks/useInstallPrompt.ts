import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallPromptState {
  /** True when the browser fired beforeinstallprompt (Chrome/Edge/Android). */
  canPrompt: boolean;
  /** True on iOS Safari — the user must add to home screen manually. */
  isIOS: boolean;
  /** True when the app is already running standalone or has been installed. */
  installed: boolean;
  /** Trigger the native install prompt. No-op on iOS. */
  prompt: () => Promise<void>;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const matchMedia = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari exposes a non-standard `standalone` boolean on navigator.
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;
  return Boolean(matchMedia || iosStandalone);
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Modern iPads report as Macintosh + touch support.
  const iPadOS =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [installed, setInstalled] = useState<boolean>(detectStandalone());

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return {
    canPrompt: deferred !== null,
    isIOS: detectIOS(),
    installed,
    prompt: async () => {
      if (!deferred) return;
      await deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        // ignored — user dismissed
      }
      setDeferred(null);
    },
  };
}
