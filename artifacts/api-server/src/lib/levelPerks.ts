import { costOfLevel, levelForXp } from "./wallet";

/**
 * What a level actually unlocks.
 *
 * Every entry here is enforced somewhere in this server. Listing a perk the
 * code does not honour would make the ladder a wish list, and the number it
 * describes worthless — which is exactly the state the level was in before
 * this file existed.
 */
export interface LevelPerk {
  level: number;
  /** Coins that must have been spent to hold this level. */
  cost: number;
  title: string;
  detail: string;
}

/** Rooms one account may keep open, by level. */
const ROOM_LIMITS: { minLevel: number; rooms: number }[] = [
  { minLevel: 10, rooms: 8 },
  { minLevel: 5, rooms: 5 },
  { minLevel: 0, rooms: 3 },
];

export function roomLimitForLevel(level: number): number {
  return ROOM_LIMITS.find((tier) => level >= tier.minLevel)?.rooms ?? 3;
}

/** Badge colour band, so the number reads at a glance in a list. */
const BADGE_BANDS: { minLevel: number; color: string }[] = [
  { minLevel: 20, color: "#F0B429" },
  { minLevel: 10, color: "#E14BC0" },
  { minLevel: 5, color: "#3E88DE" },
  { minLevel: 1, color: "#1E9E4A" },
  { minLevel: 0, color: "#8A8A93" },
];

export function badgeColorForLevel(level: number): string {
  return BADGE_BANDS.find((band) => level >= band.minLevel)?.color ?? "#8A8A93";
}

/**
 * The ladder shown on the level screen. Deliberately short: only levels that
 * change something appear, rather than padding it out with milestones that
 * unlock nothing.
 */
export const LEVEL_PERKS: LevelPerk[] = [
  {
    level: 1,
    cost: costOfLevel(1),
    title: "شارة ملوّنة وأولوية بالغرف",
    detail: "شارتك تتلوّن، وغرفك تظهر أعلى بالقائمة عند تساوي عدد المستمعين.",
  },
  {
    level: 5,
    cost: costOfLevel(5),
    title: "٥ غرف بدل ٣",
    detail: "تقدر تفتح خمس غرف في نفس الوقت.",
  },
  {
    level: 10,
    cost: costOfLevel(10),
    title: "٨ غرف وشارة مميّزة",
    detail: "ثمان غرف مفتوحة، ولون شارة يميّزك عن البقية.",
  },
  {
    level: 20,
    cost: costOfLevel(20),
    title: "الشارة الذهبية",
    detail: "أعلى لون شارة بالتطبيق.",
  },
];

export interface LevelView {
  level: number;
  spent: number;
  nextAt: number;
  badgeColor: string;
  roomLimit: number;
  perks: LevelPerk[];
}

/** Everything the level screen needs, derived from one number. */
export function levelViewFor(xp: number): LevelView {
  const level = levelForXp(xp);
  return {
    level,
    spent: Math.max(0, xp),
    // At the cap the bar is full rather than pointing at a level that
    // cannot be reached.
    nextAt: costOfLevel(level + 1),
    badgeColor: badgeColorForLevel(level),
    roomLimit: roomLimitForLevel(level),
    perks: LEVEL_PERKS,
  };
}
