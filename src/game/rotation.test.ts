import { describe, it, expect } from "vitest";
import {
  getStoryHolder,
  getStoryHolderIndex,
  getRound,
  isFinalTurn,
  totalTurns,
} from "./rotation";

describe("getStoryHolderIndex", () => {
  it("returns the original author on turn 1", () => {
    expect(getStoryHolderIndex(0, 1, 4)).toBe(0);
    expect(getStoryHolderIndex(2, 1, 4)).toBe(2);
  });

  it("shifts by one seat per turn", () => {
    expect(getStoryHolderIndex(0, 2, 4)).toBe(1);
    expect(getStoryHolderIndex(0, 3, 4)).toBe(2);
    expect(getStoryHolderIndex(0, 4, 4)).toBe(3);
  });

  it("wraps around at the end of a round", () => {
    expect(getStoryHolderIndex(3, 2, 4)).toBe(0);
    expect(getStoryHolderIndex(3, 3, 4)).toBe(1);
  });

  it("returns to the original author at the start of round 2", () => {
    const N = 4;
    for (let i = 0; i < N; i++) {
      expect(getStoryHolderIndex(i, N + 1, N)).toBe(i);
    }
  });

  it("ensures every story is held by every player exactly once per round", () => {
    const N = 5;
    for (let storyIdx = 0; storyIdx < N; storyIdx++) {
      const seen = new Set<number>();
      for (let t = 1; t <= N; t++) {
        seen.add(getStoryHolderIndex(storyIdx, t, N));
      }
      expect(seen.size).toBe(N);
    }
  });

  it("never gives two different stories to the same player on the same turn", () => {
    const N = 6;
    for (let t = 1; t <= N * 2; t++) {
      const holders = new Set<number>();
      for (let storyIdx = 0; storyIdx < N; storyIdx++) {
        holders.add(getStoryHolderIndex(storyIdx, t, N));
      }
      expect(holders.size).toBe(N);
    }
  });

  it("throws for invalid inputs", () => {
    expect(() => getStoryHolderIndex(0, 0, 4)).toThrow();
    expect(() => getStoryHolderIndex(0, 1, 0)).toThrow();
  });
});

describe("getStoryHolder (with playerOrder)", () => {
  it("returns the correct player id", () => {
    const order = ["alice", "bob", "carol", "dave"];
    expect(getStoryHolder(0, 1, order)).toBe("alice");
    expect(getStoryHolder(0, 2, order)).toBe("bob");
    expect(getStoryHolder(3, 2, order)).toBe("alice");
  });
});

describe("getRound / isFinalTurn / totalTurns", () => {
  it("counts the N*totalRounds passing turns plus one private finishing turn", () => {
    expect(totalTurns(3, 2)).toBe(7);
    expect(totalTurns(5, 3)).toBe(16);
  });

  it("computes the round number", () => {
    const N = 4;
    expect(getRound(1, N)).toBe(1);
    expect(getRound(4, N)).toBe(1);
    expect(getRound(5, N)).toBe(2);
    expect(getRound(8, N)).toBe(2);
    expect(getRound(9, N)).toBe(3);
  });

  it("identifies only the single private finishing turn as the final turn", () => {
    // 4 players, 2 rounds → 8 regular turns, finishing turn is turn 9
    expect(isFinalTurn(4, 4, 2)).toBe(false);
    expect(isFinalTurn(5, 4, 2)).toBe(false);
    expect(isFinalTurn(8, 4, 2)).toBe(false);
    expect(isFinalTurn(9, 4, 2)).toBe(true);
    expect(isFinalTurn(10, 4, 2)).toBe(false);
    // 4 players, 3 rounds → 12 regular turns, finishing turn is turn 13
    expect(isFinalTurn(12, 4, 3)).toBe(false);
    expect(isFinalTurn(13, 4, 3)).toBe(true);
  });

  it("puts every player on their own story on the final turn", () => {
    const N = 5;
    const totalRounds = 2;
    const finalTurn = N * totalRounds + 1;
    for (let storyIdx = 0; storyIdx < N; storyIdx++) {
      expect(getStoryHolderIndex(storyIdx, finalTurn, N)).toBe(storyIdx);
    }
  });
});
