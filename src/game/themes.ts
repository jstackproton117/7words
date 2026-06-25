export const THEME_POOL: readonly string[] = [
  "Space",
  "Fairy Tale",
  "Office Drama",
  "Horror",
  "Road Trip",
  "Underwater",
  "Medieval",
  "Superheroes",
  "Haunted House",
  "The Future",
  "Wildlife Documentary",
  "Cooking Show Gone Wrong",
];

export function sampleThemes(count: number, pool: readonly string[] = THEME_POOL): string[] {
  const copy = pool.slice();
  const take = Math.min(count, copy.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, take);
}
