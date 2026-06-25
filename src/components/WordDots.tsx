interface Props {
  count: number;
  max: number;
  target?: number;
}

export function WordDots({ count, max, target }: Props) {
  const dots = Array.from({ length: max }, (_, i) => i);
  const goal = target ?? max;
  return (
    <div className="flex items-center gap-2 justify-center" aria-label={`${count} of ${goal} words`}>
      {dots.map((i) => {
        const filled = i < count;
        const isOverTarget = target !== undefined && i >= target;
        return (
          <span
            key={i}
            className={`inline-block rounded-full transition-all ${
              filled
                ? isOverTarget
                  ? "w-3 h-3 bg-amber-600"
                  : "w-3 h-3 bg-stone-900"
                : "w-2 h-2 bg-stone-300"
            }`}
          />
        );
      })}
    </div>
  );
}
