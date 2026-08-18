/**
 * Geometry for a classic 15x15 Ludo board.
 *
 * The server's position model (see api-server `lib/ludoSession.ts`) is purely
 * numeric and relative to each colour:
 *   -1        → in the yard
 *   0..50     → the shared 52-cell ring, offset by the colour's start
 *   51..56    → that colour's private 6-cell home column
 *   57        → finished (centre)
 *
 * This module turns those numbers into grid cells so the board can draw them.
 * Grid coordinates are `{ col, row }` with 0,0 at the top-left.
 */

export type LudoColor = "red" | "green" | "yellow" | "blue";

export interface Cell {
  col: number;
  row: number;
}

export const GRID = 15;
export const FINISH = 57;
const RING_SIZE = 52;

/**
 * The 52 ring cells in travel order, starting at red's entry square. Walking
 * this clockwise: left arm → up the vertical arm → across the top → down the
 * right of it → right arm → and so on around the cross.
 */
export const RING: Cell[] = [
  // left arm, upper lane (red enters here)
  { col: 1, row: 6 }, { col: 2, row: 6 }, { col: 3, row: 6 }, { col: 4, row: 6 }, { col: 5, row: 6 },
  // up the left side of the top arm
  { col: 6, row: 5 }, { col: 6, row: 4 }, { col: 6, row: 3 }, { col: 6, row: 2 }, { col: 6, row: 1 }, { col: 6, row: 0 },
  // across the top notch
  { col: 7, row: 0 },
  // down the right side of the top arm (green enters at the first of these)
  { col: 8, row: 0 }, { col: 8, row: 1 }, { col: 8, row: 2 }, { col: 8, row: 3 }, { col: 8, row: 4 }, { col: 8, row: 5 },
  // right arm, upper lane
  { col: 9, row: 6 }, { col: 10, row: 6 }, { col: 11, row: 6 }, { col: 12, row: 6 }, { col: 13, row: 6 }, { col: 14, row: 6 },
  // right notch
  { col: 14, row: 7 },
  // right arm, lower lane (yellow enters here)
  { col: 14, row: 8 }, { col: 13, row: 8 }, { col: 12, row: 8 }, { col: 11, row: 8 }, { col: 10, row: 8 }, { col: 9, row: 8 },
  // down the right side of the bottom arm
  { col: 8, row: 9 }, { col: 8, row: 10 }, { col: 8, row: 11 }, { col: 8, row: 12 }, { col: 8, row: 13 }, { col: 8, row: 14 },
  // bottom notch
  { col: 7, row: 14 },
  // up the left side of the bottom arm (blue enters at the first of these)
  { col: 6, row: 14 }, { col: 6, row: 13 }, { col: 6, row: 12 }, { col: 6, row: 11 }, { col: 6, row: 10 }, { col: 6, row: 9 },
  // left arm, lower lane
  { col: 5, row: 8 }, { col: 4, row: 8 }, { col: 3, row: 8 }, { col: 2, row: 8 }, { col: 1, row: 8 }, { col: 0, row: 8 },
  // left notch
  { col: 0, row: 7 },
  // back to the start
  { col: 0, row: 6 },
];

/** Ring index each colour steps onto when it leaves the yard. */
export const START_INDEX: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/**
 * Protected ring cells — the four coloured entry squares plus the four stars.
 * Tokens here cannot be captured. Mirrors SAFE_CELLS on the server.
 */
export const SAFE_RING_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Each colour's 6 home-column cells, ordered from the ring toward the centre. */
export const HOME_COLUMN: Record<LudoColor, Cell[]> = {
  red: [1, 2, 3, 4, 5, 6].map((col) => ({ col, row: 7 })),
  green: [1, 2, 3, 4, 5, 6].map((row) => ({ col: 7, row })),
  yellow: [13, 12, 11, 10, 9, 8].map((col) => ({ col, row: 7 })),
  blue: [13, 12, 11, 10, 9, 8].map((row) => ({ col: 7, row })),
};

/** The 6x6 yard block for each colour, as its top-left grid cell. */
export const YARD_ORIGIN: Record<LudoColor, Cell> = {
  red: { col: 0, row: 0 },
  green: { col: 9, row: 0 },
  yellow: { col: 9, row: 9 },
  blue: { col: 0, row: 9 },
};

/** Where a colour's four tokens rest inside its yard (grid units, fractional). */
export function yardSlots(color: LudoColor): Cell[] {
  const { col, row } = YARD_ORIGIN[color];
  return [
    { col: col + 1.3, row: row + 1.3 },
    { col: col + 3.3, row: row + 1.3 },
    { col: col + 1.3, row: row + 3.3 },
    { col: col + 3.3, row: row + 3.3 },
  ];
}

export const CENTER: Cell = { col: 7, row: 7 };

/**
 * Resolve a server token position to the grid cell it should be drawn at.
 * `slot` picks which yard nook an un-entered token sits in.
 */
export function cellForPosition(color: LudoColor, pos: number, slot: number): Cell {
  if (pos < 0) return yardSlots(color)[slot] ?? YARD_ORIGIN[color];
  if (pos >= FINISH) return CENTER;
  if (pos >= 51) return HOME_COLUMN[color][pos - 51] ?? CENTER;
  return RING[(START_INDEX[color] + pos) % RING_SIZE];
}

/** Global ring index for a token, or null when it is off the ring. */
export function ringIndexFor(color: LudoColor, pos: number): number | null {
  if (pos < 0 || pos > 50) return null;
  return (START_INDEX[color] + pos) % RING_SIZE;
}
