export type ValidationResult =
  | { ok: true; newOpenOwner: string | null }
  | { ok: false; reason: string };

export interface ValidationInput {
  text: string;
  openSentenceOwner: string | null;
  playerId: string;
  isFinalRound: boolean;
}

export function validateContribution(input: ValidationInput): ValidationResult {
  const { text, openSentenceOwner, playerId, isFinalRound } = input;
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const terminalCount = (trimmed.match(/[.!?]/g) || []).length;
  const endsWithTerminal = /[.!?]$/.test(trimmed);

  if (!isFinalRound && words.length !== 7) {
    return { ok: false, reason: "Use exactly 7 words." };
  }
  if (isFinalRound && (words.length < 1 || words.length > 14)) {
    return { ok: false, reason: "Use between 1 and 14 words." };
  }

  if (!isFinalRound) {
    if (terminalCount > 1) {
      return {
        ok: false,
        reason: "Only one period, question mark, or exclamation point per turn.",
      };
    }

    if (terminalCount === 1) {
      if (openSentenceOwner === null) {
        return {
          ok: false,
          reason: "You can't open and close a sentence in the same turn.",
        };
      }
      if (openSentenceOwner === playerId) {
        return {
          ok: false,
          reason: "You started this sentence — leave the ending for someone else.",
        };
      }
    }
  }

  let newOpenOwner: string | null;
  if (terminalCount === 0) {
    newOpenOwner = openSentenceOwner ?? playerId;
  } else if (endsWithTerminal) {
    newOpenOwner = null;
  } else {
    newOpenOwner = playerId;
  }

  return { ok: true, newOpenOwner };
}
