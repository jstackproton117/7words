interface RoundIndicatorProps {
  round: number;
  totalRounds: number;
}

export function RoundIndicator({ round, totalRounds }: RoundIndicatorProps) {
  const isFinal = round === totalRounds;
  const subtitle = isFinal
    ? "Final round — every story is coming home."
    : "Your story comes back at the end!";
  return (
    <div className="text-center flex flex-col gap-1">
      <p className="text-stone-800 font-semibold text-lg">
        Round {round} of {totalRounds}
      </p>
      <p className="text-stone-500 text-base">{subtitle}</p>
    </div>
  );
}
