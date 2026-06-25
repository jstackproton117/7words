export const TIP_QUIPS: readonly string[] = [
  "Enjoyed the game? Buy the devs a coffee! ☕",
  "Did someone's story make you snort-laugh? That costs extra. 👆",
  "The devs are also bad at ending sentences. Help them afford therapy.",
  "No pressure. But the devs have feelings. And rent.",
  "Tip jar! We promise we'll use it responsibly. (We won't.)",
  "Like the game? The devs like tacos. Just saying. 🌮",
  "Support the devs so they can add more features you'll never use.",
];

export function pickQuip(pool: readonly string[] = TIP_QUIPS): string {
  if (pool.length === 0) return "";
  return pool[Math.floor(Math.random() * pool.length)];
}
