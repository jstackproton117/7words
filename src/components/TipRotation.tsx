import { useEffect, useRef, useState } from "react";

interface TipRotationProps {
  tips: readonly string[];
  intervalMs?: number;
  className?: string;
}

export function TipRotation({
  tips,
  intervalMs = 5000,
  className,
}: TipRotationProps) {
  // Random starting tip so multiple devices in the same room aren't synced.
  const [index, setIndex] = useState(() =>
    tips.length === 0 ? 0 : Math.floor(Math.random() * tips.length)
  );
  // Re-keying the <p> on every change drives the fade-in CSS animation.
  const fadeKeyRef = useRef(0);

  useEffect(() => {
    if (tips.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % tips.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [tips.length, intervalMs]);

  if (tips.length === 0) return null;

  fadeKeyRef.current += 1;

  return (
    <div
      className={
        className ??
        "bg-white border border-stone-200 rounded-2xl px-5 py-4 text-stone-700 text-base leading-relaxed text-center min-h-[5.5rem] flex items-center justify-center"
      }
      aria-live="polite"
    >
      <p key={fadeKeyRef.current} className="tip-fade">
        {tips[index]}
      </p>
    </div>
  );
}
