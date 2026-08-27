import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  followsTable,
  userSettingsTable,
  type UserSettings,
} from "@workspace/db";

/** Accepted values, mirrored by the OpenAPI enums. */
export const NOTIFY_DM_VALUES = ["all", "none"] as const;
export const WHO_CAN_DM_VALUES = ["all", "following", "none"] as const;
export const LANGUAGE_VALUES = ["ar"] as const;

export type NotifyDm = (typeof NOTIFY_DM_VALUES)[number];
export type WhoCanDm = (typeof WHO_CAN_DM_VALUES)[number];

/** The shape every caller sees, whether or not a row exists yet. */
export interface SettingsView {
  notifyDm: NotifyDm;
  notifyLikes: boolean;
  notifyMoments: boolean;
  notifyVisitors: boolean;
  whoCanDm: WhoCanDm;
  hideOnline: boolean;
  invisibleRoomEntry: boolean;
  invisibleBrowsing: boolean;
  language: string;
}

/**
 * Defaults for an account that has never opened the settings screen. These
 * must stay identical to the column defaults in the schema — a user reading
 * their settings before any write must see what the server will actually do.
 */
export const DEFAULT_SETTINGS: SettingsView = {
  notifyDm: "all",
  notifyLikes: true,
  notifyMoments: true,
  notifyVisitors: true,
  whoCanDm: "all",
  hideOnline: false,
  invisibleRoomEntry: false,
  invisibleBrowsing: false,
  language: "ar",
};

function toView(row: UserSettings): SettingsView {
  return {
    // The columns are plain text, so a value written before an enum changed
    // could be unknown. Fall back rather than hand a bad value to a caller
    // that branches on it.
    notifyDm: NOTIFY_DM_VALUES.includes(row.notifyDm as NotifyDm)
      ? (row.notifyDm as NotifyDm)
      : DEFAULT_SETTINGS.notifyDm,
    notifyLikes: row.notifyLikes,
    notifyMoments: row.notifyMoments,
    notifyVisitors: row.notifyVisitors,
    whoCanDm: WHO_CAN_DM_VALUES.includes(row.whoCanDm as WhoCanDm)
      ? (row.whoCanDm as WhoCanDm)
      : DEFAULT_SETTINGS.whoCanDm,
    hideOnline: row.hideOnline,
    invisibleRoomEntry: row.invisibleRoomEntry,
    invisibleBrowsing: row.invisibleBrowsing,
    language: row.language,
  };
}

/**
 * Read one user's settings. Returns the defaults when no row exists — reads
 * never write, so the enforcement paths (every direct message, every room
 * join) stay a single SELECT instead of an upsert.
 */
export async function getSettings(userId: string): Promise<SettingsView> {
  const [row] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId))
    .limit(1);
  return row ? toView(row) : { ...DEFAULT_SETTINGS };
}

/**
 * Read settings for many users at once, keyed by userId. Used by the profile
 * directory, which renders up to 100 rows and must not issue a query per row.
 * Users without a row are absent from the map; callers fall back to defaults.
 */
export async function settingsForUsers(
  userIds: string[],
): Promise<Map<string, SettingsView>> {
  const map = new Map<string, SettingsView>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select()
    .from(userSettingsTable)
    .where(inArray(userSettingsTable.userId, userIds));
  for (const row of rows) map.set(row.userId, toView(row));
  return map;
}

/**
 * Apply a partial update. Only keys present in `patch` are written, so a
 * client sending one switch cannot blank the rest — the failure mode that
 * `POST /profiles/me` still has.
 */
export async function updateSettings(
  userId: string,
  patch: Partial<SettingsView>,
): Promise<SettingsView> {
  const set: Record<string, unknown> = {};
  if (patch.notifyDm !== undefined) set.notifyDm = patch.notifyDm;
  if (patch.notifyLikes !== undefined) set.notifyLikes = patch.notifyLikes;
  if (patch.notifyMoments !== undefined) set.notifyMoments = patch.notifyMoments;
  if (patch.notifyVisitors !== undefined) set.notifyVisitors = patch.notifyVisitors;
  if (patch.whoCanDm !== undefined) set.whoCanDm = patch.whoCanDm;
  if (patch.hideOnline !== undefined) set.hideOnline = patch.hideOnline;
  if (patch.invisibleRoomEntry !== undefined)
    set.invisibleRoomEntry = patch.invisibleRoomEntry;
  if (patch.invisibleBrowsing !== undefined)
    set.invisibleBrowsing = patch.invisibleBrowsing;
  if (patch.language !== undefined) set.language = patch.language;

  if (Object.keys(set).length === 0) return getSettings(userId);

  const [row] = await db
    .insert(userSettingsTable)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: userSettingsTable.userId, set })
    .returning();
  return toView(row);
}

/**
 * Whether `fromUserId` is allowed to open a conversation with `toUserId`,
 * according to the recipient's own preference.
 *
 * "following" means the recipient has to have followed the sender first —
 * the closest thing to SUGO's "friends only" until a mutual-friend relation
 * exists. Blocking is a separate, stronger check in sendDm.
 */
export async function canDm(fromUserId: string, toUserId: string): Promise<boolean> {
  const { whoCanDm } = await getSettings(toUserId);
  if (whoCanDm === "all") return true;
  if (whoCanDm === "none") return false;

  const [row] = await db
    .select({ id: followsTable.id })
    .from(followsTable)
    .where(
      and(
        eq(followsTable.followerId, toUserId),
        eq(followsTable.followedId, fromUserId),
      ),
    )
    .limit(1);
  return row != null;
}
