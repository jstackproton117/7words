import { describe, it, expect } from "vitest";
import { validateContribution } from "./validation";

// TODO: additional edge-case tests to add later:
//   1. Ellipsis "..." in non-final round → rejected as multiple terminals.
//   2. Contractions ("don't", "isn't") don't trip the terminal regex.
//   3. Trailing "?" and trailing "!" as sentence-closers (parity with ".").
//   4. Decimal numbers inside words ("3.14") behave as mid-string terminals
//      — confirms the documented limitation in the prompt.
//   5. Mixed adjacent terminals like "?!" count as two.
//   6. Final round: close own sentence with "?" / "!" (not just ".").
//   7. Final round: standalone one-token contributions like "Yes." or "?".
//   8. Contribution that starts with a terminal-laden first word
//      (e.g. "one. two three four five six seven") — covers a different
//      code path than terminals in the middle of the text.

const A = "playerA";
const B = "playerB";

describe("validateContribution — word count", () => {
  it("accepts exactly 7 words in a non-final round", () => {
    const r = validateContribution({
      text: "one two three four five six seven",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects 6 words in a non-final round", () => {
    const r = validateContribution({
      text: "one two three four five six",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: false,
    });
    expect(r).toEqual({ ok: false, reason: "Use exactly 7 words." });
  });

  it("rejects 8 words in a non-final round", () => {
    const r = validateContribution({
      text: "one two three four five six seven eight",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects 0 words", () => {
    const r = validateContribution({
      text: "",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(false);
  });

  it("treats collapsed whitespace correctly (still 7 words)", () => {
    const r = validateContribution({
      text: "  one   two three   four five six seven  ",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateContribution — final-round word count", () => {
  it("accepts 1 word in the final round", () => {
    const r = validateContribution({
      text: "fin",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(true);
  });

  it("accepts 14 words in the final round", () => {
    const r = validateContribution({
      text: "a b c d e f g h i j k l m n",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects 0 words in the final round", () => {
    const r = validateContribution({
      text: "",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects 15 words in the final round", () => {
    const r = validateContribution({
      text: "a b c d e f g h i j k l m n o",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateContribution — zero terminal marks", () => {
  it("keeps the existing open-sentence owner when present", () => {
    const r = validateContribution({
      text: "one two three four five six seven",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: false,
    });
    expect(r).toEqual({ ok: true, newOpenOwner: B });
  });

  it("makes the current player the owner if none was open", () => {
    const r = validateContribution({
      text: "one two three four five six seven",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: false,
    });
    expect(r).toEqual({ ok: true, newOpenOwner: A });
  });

  it("keeps the current player as owner if they already owned it", () => {
    const r = validateContribution({
      text: "one two three four five six seven",
      openSentenceOwner: A,
      playerId: A,
      isFinalRound: false,
    });
    expect(r).toEqual({ ok: true, newOpenOwner: A });
  });
});

describe("validateContribution — one terminal mark mid-contribution", () => {
  it("closes a sentence owned by another player and opens a new one for current player", () => {
    const r = validateContribution({
      text: "one two three. four five six seven",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: false,
    });
    expect(r).toEqual({ ok: true, newOpenOwner: A });
  });

  it("rejects closing when no sentence is open", () => {
    const r = validateContribution({
      text: "one two three. four five six seven",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/can't open and close/i);
    }
  });

  it("rejects closing your own carried-forward sentence", () => {
    const r = validateContribution({
      text: "one two three. four five six seven",
      openSentenceOwner: A,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/leave the ending/i);
    }
  });

  it("accepts question-mark and exclamation as terminal marks", () => {
    const q = validateContribution({
      text: "one two three? four five six seven",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: false,
    });
    expect(q.ok).toBe(true);

    const e = validateContribution({
      text: "one two three! four five six seven",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: false,
    });
    expect(e.ok).toBe(true);
  });
});

describe("validateContribution — one terminal mark at the end", () => {
  it("closes a sentence and leaves nothing open", () => {
    const r = validateContribution({
      text: "one two three four five six seven.",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: false,
    });
    expect(r).toEqual({ ok: true, newOpenOwner: null });
  });

  it("rejects ending a sentence you own (trailing)", () => {
    const r = validateContribution({
      text: "one two three four five six seven.",
      openSentenceOwner: A,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects ending when no sentence is open (trailing)", () => {
    const r = validateContribution({
      text: "one two three four five six seven.",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateContribution — two terminal marks", () => {
  it("rejects two terminal marks in a non-final round", () => {
    const r = validateContribution({
      text: "one two. three four. five six seven",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/only one/i);
    }
  });

  it("rejects two terminals even if last one is at the end", () => {
    const r = validateContribution({
      text: "one two. three four five six seven.",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: false,
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateContribution — final round relaxations", () => {
  it("allows multiple terminal marks", () => {
    const r = validateContribution({
      text: "Hi there. Bye now. The end!",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(true);
  });

  it("allows closing your own sentence", () => {
    const r = validateContribution({
      text: "and so the dragon flew away.",
      openSentenceOwner: A,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newOpenOwner).toBe(null);
    }
  });

  it("allows closing with no open sentence", () => {
    const r = validateContribution({
      text: "fin.",
      openSentenceOwner: null,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newOpenOwner).toBe(null);
    }
  });

  it("propagates open ownership correctly when ending mid-text", () => {
    const r = validateContribution({
      text: "the end. but then suddenly more",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newOpenOwner).toBe(A);
    }
  });

  it("keeps no-terminal contributions opening or extending the owner", () => {
    const r = validateContribution({
      text: "just a few extra words",
      openSentenceOwner: B,
      playerId: A,
      isFinalRound: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newOpenOwner).toBe(B);
    }
  });
});
