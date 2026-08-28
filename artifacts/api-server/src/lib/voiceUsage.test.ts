import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushes = vi.hoisted(() => ({ sent: [] as { userId: string; title: string }[] }));

vi.mock("./push", () => ({
  pushToUser: async (userId: string, message: { title: string }) => {
    pushes.sent.push({ userId, title: message.title });
  },
}));

import { db, adminsTable, voiceUsageTable } from "@workspace/db";
import { currentPeriod, recordVoiceSeconds, voiceUsage } from "./voiceUsage";

const PERIOD = currentPeriod();
const ADMIN = `user_vu_admin_${Date.now()}`;

/** The default allowance the library reads from the environment. */
const FREE_MINUTES = 10_000;
const minutes = (n: number) => n * 60;

async function reset(): Promise<void> {
  await db.delete(voiceUsageTable).where(eq(voiceUsageTable.period, PERIOD));
  pushes.sent.length = 0;
}

beforeEach(async () => {
  await reset();
  await db
    .insert(adminsTable)
    .values({ userId: ADMIN, email: `${ADMIN}@test.local` })
    .onConflictDoNothing();
});

afterEach(async () => {
  await reset();
  await db.delete(adminsTable).where(eq(adminsTable.userId, ADMIN));
});

describe("recording usage", () => {
  it("starts at zero for a fresh month", async () => {
    const usage = await voiceUsage();
    expect(usage.minutes).toBe(0);
    expect(usage.percent).toBe(0);
    expect(usage.freeMinutes).toBe(FREE_MINUTES);
  });

  it("accumulates across sessions", async () => {
    await recordVoiceSeconds(minutes(30));
    await recordVoiceSeconds(minutes(45));
    expect((await voiceUsage()).minutes).toBe(75);
  });

  it("ignores a zero or nonsense stint", async () => {
    await recordVoiceSeconds(0);
    await recordVoiceSeconds(-500);
    await recordVoiceSeconds(Number.NaN);
    expect((await voiceUsage()).minutes).toBe(0);
  });

  it("counts every participant, because Agora bills every participant", async () => {
    // A ten-person room running for a minute costs ten minutes of allowance.
    // Counting the room once instead of once per listener is the mistake that
    // makes the bill a surprise.
    for (let i = 0; i < 10; i++) await recordVoiceSeconds(minutes(1));
    expect((await voiceUsage()).minutes).toBe(10);
  });
});

describe("allowance warnings", () => {
  it("stays quiet well below the first threshold", async () => {
    await recordVoiceSeconds(minutes(FREE_MINUTES * 0.2));
    expect(pushes.sent).toHaveLength(0);
  });

  it("warns the admins on crossing 50%", async () => {
    await recordVoiceSeconds(minutes(FREE_MINUTES * 0.5));
    expect(pushes.sent).toHaveLength(1);
    expect(pushes.sent[0].userId).toBe(ADMIN);
    expect(pushes.sent[0].title).toContain("50%");
  });

  it("warns once per threshold, not once per session after it", async () => {
    await recordVoiceSeconds(minutes(FREE_MINUTES * 0.5));
    expect(pushes.sent).toHaveLength(1);

    // Several more sessions at the same threshold must not re-notify.
    await recordVoiceSeconds(minutes(10));
    await recordVoiceSeconds(minutes(10));
    expect(pushes.sent).toHaveLength(1);
  });

  it("warns again at the next threshold", async () => {
    await recordVoiceSeconds(minutes(FREE_MINUTES * 0.5));
    await recordVoiceSeconds(minutes(FREE_MINUTES * 0.3));
    expect(pushes.sent).toHaveLength(2);
    expect(pushes.sent[1].title).toContain("80%");
  });

  it("says plainly when the free minutes are gone", async () => {
    await recordVoiceSeconds(minutes(FREE_MINUTES));
    const last = pushes.sent.at(-1);
    expect(last?.title).toContain("100%");
  });

  it("skips the steps it jumped over rather than firing all of them", async () => {
    // One long month that lands straight past every threshold notifies once.
    await recordVoiceSeconds(minutes(FREE_MINUTES * 1.5));
    expect(pushes.sent).toHaveLength(1);
    expect(pushes.sent[0].title).toContain("100%");
  });
});
