import { describe, expect, it } from "vitest";
import { costOfLevel, LEVEL_ONE_COST } from "./wallet";
import {
  badgeColorForLevel,
  levelViewFor,
  LEVEL_PERKS,
  roomLimitForLevel,
} from "./levelPerks";

describe("room limit", () => {
  it("gives every account three rooms to start", () => {
    expect(roomLimitForLevel(0)).toBe(3);
    expect(roomLimitForLevel(4)).toBe(3);
  });

  it("raises the ceiling at the levels the ladder advertises", () => {
    expect(roomLimitForLevel(5)).toBe(5);
    expect(roomLimitForLevel(9)).toBe(5);
    expect(roomLimitForLevel(10)).toBe(8);
    expect(roomLimitForLevel(50)).toBe(8);
  });

  it("never drops as the level rises", () => {
    for (let n = 0; n < 50; n++) {
      expect(roomLimitForLevel(n + 1)).toBeGreaterThanOrEqual(roomLimitForLevel(n));
    }
  });
});

describe("badge colour", () => {
  it("bands by level and always returns a colour", () => {
    const bands = [0, 1, 5, 10, 20, 50].map(badgeColorForLevel);
    for (const c of bands) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
    // Level 0 must look different from a levelled account, or the badge says
    // nothing.
    expect(badgeColorForLevel(0)).not.toBe(badgeColorForLevel(1));
  });
});

describe("the advertised ladder", () => {
  it("only lists levels that actually unlock something", () => {
    // Every perk here is enforced in this server. A milestone that changes
    // nothing would make the whole ladder a wish list.
    const enforced = new Set([1, 5, 10, 20]);
    for (const perk of LEVEL_PERKS) expect(enforced.has(perk.level)).toBe(true);
  });

  it("quotes the same cost the level maths charges", () => {
    for (const perk of LEVEL_PERKS) {
      expect(perk.cost).toBe(costOfLevel(perk.level));
    }
  });

  it("is ordered and has no duplicates", () => {
    const levels = LEVEL_PERKS.map((p) => p.level);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(new Set(levels).size).toBe(levels.length);
  });
});

describe("the level screen payload", () => {
  it("shows a new account what it needs for level 1", () => {
    const view = levelViewFor(0);
    expect(view.level).toBe(0);
    expect(view.spent).toBe(0);
    expect(view.nextAt).toBe(LEVEL_ONE_COST);
    expect(view.roomLimit).toBe(3);
  });

  it("reports progress inside the current level", () => {
    const view = levelViewFor(5_000);
    expect(view.level).toBe(1);
    expect(view.spent).toBe(5_000);
    // Level 2 costs 12,000, so the bar is partway rather than full.
    expect(view.nextAt).toBe(costOfLevel(2));
    expect(view.spent).toBeLessThan(view.nextAt);
  });

  it("keeps the target ahead of the spend at every level", () => {
    for (const xp of [0, 2_999, 3_000, 50_000, 300_000, 1_200_000]) {
      const view = levelViewFor(xp);
      expect(view.nextAt).toBeGreaterThan(view.spent);
    }
  });

  it("never reports a negative spend", () => {
    expect(levelViewFor(-500).spent).toBe(0);
  });
});
