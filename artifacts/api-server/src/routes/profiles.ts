import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, ne, notInArray, or } from "drizzle-orm";
import { db, profilesTable, walletsTable, type Profile } from "@workspace/db";
import {
  ListProfilesResponse,
  ListVisitorsResponse,
  UpsertMyProfileBody,
  UpsertMyProfileResponse,
  GetProfileParams,
  GetProfileResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/authz";
import { levelForXp } from "../lib/wallet";
import { sendWelcomeDm } from "../lib/official";
import { blockedIdsFor } from "../lib/safety";
import { getSettings, settingsForUsers } from "../lib/settings";
import { listVisitors, recordProfileVisit } from "../lib/visitors";

const router: IRouter = Router();

const MAX_DIRECTORY = 100;
// A profile counts as online when it was refreshed within this window; the
// client refreshes on launch and on foreground.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

router.use("/profiles", requireAuth);
// Path-scoped guards: /visitors lives on this router but is not under
// /profiles, so it needs its own — without this it would be public.
router.use("/visitors", requireAuth);

/**
 * `hideOnline` comes from the profile owner's own privacy setting. When it is
 * on the account always reads as offline to everyone else — the raw
 * `lastSeenAt` is still returned because conversations and ordering depend on
 * it, but the dot the app renders is driven by `isOnline`.
 */
function serialize(profile: Profile, xp: number | null, hideOnline = false) {
  return {
    userId: profile.userId,
    name: profile.name,
    avatar: profile.avatar,
    bio: profile.bio,
    gender: profile.gender,
    age: profile.age,
    country: profile.country,
    level: levelForXp(xp ?? 0),
    isOnline: hideOnline
      ? false
      : Date.now() - profile.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
    isOfficial: profile.isOfficial,
    isHost: profile.isHost,
    lastSeenAt: profile.lastSeenAt.toISOString(),
  };
}

router.get("/profiles", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  // Blocking hides both ways: neither party surfaces in the other list.
  const hidden = await blockedIdsFor(userId);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  // The directory is for discovering other people; exclude the caller.
  const filters = [ne(profilesTable.userId, userId)];
  if (hidden.length > 0) filters.push(notInArray(profilesTable.userId, hidden));
  if (q) {
    // Escape the wildcards so a search for "%" does not match everyone.
    const term = `%${q.replace(/[%_]/g, (c) => "\\" + c)}%`;
    // The public id is the number people actually read off a profile and pass
    // to a friend, so it searches alongside the display name.
    filters.push(or(ilike(profilesTable.name, term), ilike(walletsTable.publicId, term))!);
  }

  const rows = await db
    .select({ profile: profilesTable, xp: walletsTable.xp })
    .from(profilesTable)
    .leftJoin(walletsTable, eq(walletsTable.userId, profilesTable.userId))
    .where(and(...filters))
    .orderBy(desc(profilesTable.lastSeenAt))
    .limit(MAX_DIRECTORY);
  // One query for the whole page rather than one per row — the directory
  // returns up to MAX_DIRECTORY profiles.
  const settings = await settingsForUsers(rows.map((r) => r.profile.userId));
  res.json(
    ListProfilesResponse.parse(
      rows.map((r) =>
        serialize(r.profile, r.xp, settings.get(r.profile.userId)?.hideOnline),
      ),
    ),
  );
});

router.post("/profiles/me", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = UpsertMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  // Whether this account is new decides if it gets the one-time welcome.
  const [before] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  const isNewAccount = before == null;

  // The row is always keyed to the authenticated id, so a client cannot write
  // into somebody else's directory entry.
  const values = {
    userId,
    name: body.name ?? "",
    avatar: body.avatar ?? "",
    bio: body.bio ?? "",
    gender: body.gender ?? "",
    age: body.age ?? 0,
    country: body.country ?? "",
    lastSeenAt: new Date(),
  };
  const [row] = await db
    .insert(profilesTable)
    .values(values)
    .onConflictDoUpdate({
      target: profilesTable.userId,
      set: {
        name: values.name,
        avatar: values.avatar,
        bio: values.bio,
        gender: values.gender,
        age: values.age,
        country: values.country,
        lastSeenAt: values.lastSeenAt,
      },
    })
    .returning();

  const [wallet] = await db
    .select({ xp: walletsTable.xp })
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);

  if (isNewAccount) {
    // Fire and forget — onboarding must never delay or fail the response.
    void sendWelcomeDm(userId, values.name);
  }

  res.json(UpsertMyProfileResponse.parse(serialize(row, wallet?.xp ?? 0)));
});

router.get("/profiles/:userId", async (req, res): Promise<void> => {
  const params = GetProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ profile: profilesTable, xp: walletsTable.xp })
    .from(profilesTable)
    .leftJoin(walletsTable, eq(walletsTable.userId, profilesTable.userId))
    .where(eq(profilesTable.userId, params.data.userId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }
  // Viewing your own profile always shows your true state; the setting hides
  // you from other people, not from yourself.
  const viewerId = (req as AuthedRequest).userId!;
  const isSelf = params.data.userId === viewerId;
  const hideOnline = isSelf ? false : (await getSettings(params.data.userId)).hideOnline;

  if (!isSelf) {
    // Fire and forget — the profile must render whether or not this lands.
    const [viewer] = await db
      .select({ name: profilesTable.name })
      .from(profilesTable)
      .where(eq(profilesTable.userId, viewerId))
      .limit(1);
    void recordProfileVisit({
      profileUserId: params.data.userId,
      visitorUserId: viewerId,
      visitorName: viewer?.name ?? "",
    });
  }

  res.json(GetProfileResponse.parse(serialize(row.profile, row.xp, hideOnline)));
});

router.get("/visitors", async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  res.json(ListVisitorsResponse.parse(await listVisitors(userId)));
});

export default router;
