// Player attribution colors. Picked from Tailwind's 700-shade range so they
// read clearly on the light/stone background prescribed by the design notes.
// Order matters — players are assigned by join index.
export const PLAYER_COLORS = [
  "#be123c", // rose-700
  "#0369a1", // sky-700
  "#047857", // emerald-700
  "#b45309", // amber-700
  "#6d28d9", // violet-700
  "#be185d", // pink-700
  "#0f766e", // teal-700
  "#4338ca", // indigo-700
] as const;

export function colorForJoinIndex(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
