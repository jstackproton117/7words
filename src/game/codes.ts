// Skip "I" and "O" — easily confused with 1 and 0 when read aloud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateGameCode(length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function normalizeGameCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidGameCodeShape(input: string): boolean {
  const normalized = normalizeGameCode(input);
  if (normalized.length !== 4) return false;
  for (const ch of normalized) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
