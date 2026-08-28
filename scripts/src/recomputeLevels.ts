import { db, walletsTable, walletTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

/**
 * Recompute every wallet's XP from the ledger under the current rules.
 *
 * XP used to be granted for recharges and task rewards as well as spending,
 * so stored values include coins that were never spent. The ledger is the
 * source of truth and it is complete — every balance change goes through
 * adjustWalletTx, which always writes a row — so the correct value can simply
 * be replayed rather than guessed at.
 *
 * Safe to run repeatedly: it sets, never adds.
 *
 *   pnpm --filter @workspace/scripts run recompute:levels
 *   pnpm --filter @workspace/scripts run recompute:levels -- --apply
 */

const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  // Mirrors xpGainFor: coins only, debits only, gifts and purchases only.
  const spending = await db
    .select({
      userId: walletTransactionsTable.userId,
      spent: sql<string>`sum(-${walletTransactionsTable.amount})`,
    })
    .from(walletTransactionsTable)
    .where(
      sql`${walletTransactionsTable.currency} = 'coins'
        and ${walletTransactionsTable.amount} < 0
        and ${walletTransactionsTable.type} in ('gift_sent', 'purchase')`,
    )
    .groupBy(walletTransactionsTable.userId);

  const correct = new Map(spending.map((r) => [r.userId, Number(r.spent)]));
  const wallets = await db
    .select({ userId: walletsTable.userId, xp: walletsTable.xp })
    .from(walletsTable);

  let changed = 0;
  for (const wallet of wallets) {
    const next = correct.get(wallet.userId) ?? 0;
    if (next === wallet.xp) continue;
    changed += 1;
    console.log(`  ${wallet.userId}: ${wallet.xp} -> ${next}`);
    if (APPLY) {
      await db
        .update(walletsTable)
        .set({ xp: next })
        .where(eq(walletsTable.userId, wallet.userId));
    }
  }

  console.log(
    `\n${wallets.length} wallets, ${changed} would change` +
      (APPLY ? " — applied." : ". Re-run with --apply to write."),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
