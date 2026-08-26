import { describe, expect, it } from "vitest";
import { hasWonWith, type LudoColor } from "./ludoSession";

const FINISH = 57;
const ALL_HOME = [FINISH, FINISH, FINISH, FINISH];
const NONE_HOME = [-1, -1, -1, -1];
const ALMOST = [FINISH, FINISH, FINISH, 40];

type Positions = Record<LudoColor, number[]>;

function board(overrides: Partial<Positions> = {}): Positions {
  // An unseated colour has an empty array — that is the state the vacuous
  // [].every() trap hides in.
  return { red: [], green: [], yellow: [], blue: [], ...overrides };
}

describe("solo win", () => {
  const seated: LudoColor[] = ["red", "green", "yellow", "blue"];
  const full = board({
    red: ALL_HOME,
    green: NONE_HOME,
    yellow: NONE_HOME,
    blue: NONE_HOME,
  });

  it("ends the game when one player brings every token home", () => {
    expect(hasWonWith(false, seated, full, "red")).toBe(true);
  });

  it("does not end on the last token still travelling", () => {
    const near = board({ red: ALMOST, green: NONE_HOME, yellow: NONE_HOME, blue: NONE_HOME });
    expect(hasWonWith(false, seated, near, "red")).toBe(false);
  });

  it("ignores the partner in a free-for-all", () => {
    // Red is home, yellow is not — in solo play that is still a red win.
    expect(hasWonWith(false, seated, full, "red")).toBe(true);
  });
});

describe("team win", () => {
  const seated: LudoColor[] = ["red", "green", "yellow", "blue"];

  it("waits for the partner before ending the game", () => {
    const positions = board({
      red: ALL_HOME,
      yellow: ALMOST,
      green: NONE_HOME,
      blue: NONE_HOME,
    });
    expect(hasWonWith(true, seated, positions, "red")).toBe(false);
  });

  it("ends when both partners are home", () => {
    const positions = board({
      red: ALL_HOME,
      yellow: ALL_HOME,
      green: NONE_HOME,
      blue: NONE_HOME,
    });
    expect(hasWonWith(true, seated, positions, "red")).toBe(true);
    // Either partner reporting the win is the same result.
    expect(hasWonWith(true, seated, positions, "yellow")).toBe(true);
  });

  it("pairs opposite seats, not adjacent ones", () => {
    // Red + green are opponents; green being home must not win it for red.
    const positions = board({
      red: ALL_HOME,
      green: ALL_HOME,
      yellow: NONE_HOME,
      blue: NONE_HOME,
    });
    expect(hasWonWith(true, seated, positions, "red")).toBe(false);
    expect(hasWonWith(true, seated, positions, "green")).toBe(false);
  });

  it("does not let an unseated partner win the game by default", () => {
    // The regression guard: blue never joined, so its position array is empty
    // and [].every() would report every token home.
    const threeSeats: LudoColor[] = ["red", "green", "yellow"];
    const positions = board({ red: NONE_HOME, green: ALL_HOME, yellow: NONE_HOME });
    expect(hasWonWith(true, threeSeats, positions, "green")).toBe(true);
    // …and an unseated colour can never win on its own.
    expect(hasWonWith(true, threeSeats, positions, "blue")).toBe(false);
  });

  it("never wins for a colour that is not at the table", () => {
    const twoSeats: LudoColor[] = ["red", "yellow"];
    const positions = board({ red: ALL_HOME, yellow: ALL_HOME });
    expect(hasWonWith(false, twoSeats, positions, "green")).toBe(false);
    expect(hasWonWith(true, twoSeats, positions, "blue")).toBe(false);
  });
});
