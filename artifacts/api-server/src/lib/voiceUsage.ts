import { eq, sql } from "drizzle-orm";
import { db, adminsTable, voiceUsageTable } from "@workspace/db";
import { logger } from "./logger";
import { pushToUser } from "./push";

/**
 * Agora's monthly free allowance, in participant-minutes. Override once the
 * account moves to a paid plan so the warnings track the real budget rather
 * than a number that stopped applying.
 */
const FREE_MINUTES = Number(process.env["AGORA_FREE_MINUTES"] ?? 10_000);

/**
 * Percentages that trigger a warning. 50 is early enough to react, 100 says
 * the free allowance is gone and every further minute is billed.
 */
const ALERT_STEPS = [50, 80, 95, 100] as const;

/** Calendar month in UTC — the period Agora's allowance resets on. */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface UsageView {
  period: string;
  minutes: number;
  freeMinutes: number;
  percent: number;
}

function toView(period: string, seconds: number): UsageView {
  const minutes = Math.round(seconds / 60);
  return {
    period,
    minutes,
    freeMinutes: FREE_MINUTES,
    percent: FREE_MINUTES > 0 ? Math.round((minutes / FREE_MINUTES) * 100) : 0,
  };
}

/** Usage so far this month. */
export async function voiceUsage(period = currentPeriod()): Promise<UsageView> {
  const [row] = await db
    .select({ seconds: voiceUsageTable.seconds })
    .from(voiceUsageTable)
    .where(eq(voiceUsageTable.period, period))
    .limit(1);
  return toView(period, row?.seconds ?? 0);
}

/** The highest step this usage has passed, or 0. */
function stepFor(percent: number): number {
  let reached = 0;
  for (const step of ALERT_STEPS) if (percent >= step) reached = step;
  return reached;
}

async function warnAdmins(view: UsageView, step: number): Promise<void> {
  const admins = await db.select({ userId: adminsTable.userId }).from(adminsTable);
  const reachable = admins.map((a) => a.userId).filter((id) => id.length > 0);
  if (reachable.length === 0) return;

  const body =
    step >= 100
      ? `استهلكت ${view.minutes.toLocaleString("en-US")} دقيقة — انتهت الدقائق المجانية وكل دقيقة بعدها محسوبة.`
      : `استهلكت ${view.minutes.toLocaleString("en-US")} من ${view.freeMinutes.toLocaleString("en-US")} دقيقة مجانية هذا الشهر.`;

  await Promise.all(
    reachable.map((userId) =>
      pushToUser(userId, {
        title: `تنبيه استهلاك الصوت — ${step}%`,
        body,
        data: { type: "voice_usage", period: view.period, percent: step },
      }),
    ),
  );
  logger.warn({ period: view.period, minutes: view.minutes, step }, "Voice allowance warning");
}

/**
 * Add one participant's stint to this month's total, and warn the admins the
 * first time usage crosses a threshold.
 *
 * Fire-and-forget from the socket layer: a failure here must never affect
 * somebody leaving a room.
 */
export async function recordVoiceSeconds(seconds: number): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const period = currentPeriod();
  try {
    // Upsert and increment atomically — several people leave rooms at once.
    const [row] = await db
      .insert(voiceUsageTable)
      .values({ period, seconds: Math.round(seconds) })
      .onConflictDoUpdate({
        target: voiceUsageTable.period,
        set: { seconds: sql`${voiceUsageTable.seconds} + ${Math.round(seconds)}` },
      })
      .returning();

    const view = toView(period, row.seconds);
    const step = stepFor(view.percent);
    // Only the crossing notifies, not every session after it.
    if (step === 0 || step <= row.alertedAtPercent) return;

    await db
      .update(voiceUsageTable)
      .set({ alertedAtPercent: step })
      .where(eq(voiceUsageTable.period, period));
    await warnAdmins(view, step);
  } catch (err) {
    logger.error({ err, period }, "Failed to record voice usage");
  }
}
