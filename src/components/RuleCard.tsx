interface RuleCardProps {
  finalRound: boolean;
  round: number;
  totalRounds: number;
}

export function RuleCard({ finalRound, round, totalRounds }: RuleCardProps) {
  if (finalRound) {
    return (
      <section className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col gap-2">
        <p className="text-amber-900 font-semibold text-lg">
          🎉 This is your story — finish it!
        </p>
        <ul className="text-amber-900 text-base list-disc pl-5 leading-relaxed">
          <li>Write 1 to 14 words.</li>
          <li>You can end on a period now.</li>
          <li>Make it land!</li>
        </ul>
      </section>
    );
  }
  return (
    <section className="bg-stone-100 border border-stone-200 rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-stone-900 font-semibold text-lg">
        Round {round} of {totalRounds}
      </p>
      <ul className="text-stone-700 text-base list-disc pl-5 leading-relaxed">
        <li>Write exactly 7 words.</li>
        <li>
          If you use a period, question mark, or exclamation point, write at
          least one word after it.
        </li>
      </ul>
    </section>
  );
}
