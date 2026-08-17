import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  walletsTable,
  walletTransactionsTable,
  coinPackagesTable,
  rechargePurchasesTable,
  dailyTasksTable,
  dailyTaskClaimsTable,
  storeItemsTable,
  userItemsTable,
  vipTiersTable,
} from "@workspace/db";
import {
  GetWalletParams,
  GetWalletResponse,
  EnsureWalletParams,
  EnsureWalletResponse,
  ListWalletTransactionsParams,
  ListWalletTransactionsResponse,
  RechargeWalletParams,
  RechargeWalletBody,
  RechargeWalletResponse,
  ReconcileRechargesParams,
  ReconcileRechargesResponse,
  PurchaseItemParams,
  PurchaseItemBody,
  PurchaseItemResponse,
  ClaimTaskParams,
  ClaimTaskBody,
  ClaimTaskResponse,
  ListUserItemsParams,
  ListUserItemsResponse,
  EquipItemParams,
  EquipItemBody,
  EquipItemResponse,
  ListTaskClaimsParams,
  ListTaskClaimsResponse,
  ActivateVipParams,
  ActivateVipBody,
  ActivateVipResponse,
} from "@workspace/api-zod";
import {
  ensureWallet,
  adjustWallet,
  adjustWalletTx,
  toWalletView,
  InsufficientBalanceError,
  type Currency,
} from "../lib/wallet";
import { requireAuth, type AuthedRequest } from "../lib/authz";
import {
  verifyPurchase,
  listOwnedPurchases,
  RevenueCatConfigError,
} from "../lib/revenuecat";

const router: IRouter = Router();

// Every wallet route is scoped to a `:userId`. Require a valid session, then
// reject any request whose verified user id does not match the path — a signed
// in user can only ever read or mutate their own wallet.
router.use(requireAuth);
router.param("userId", (req, res, next, userId) => {
  if ((req as AuthedRequest).userId !== userId) {
    res.status(403).json({ error: "غير مصرح لك بالوصول" });
    return;
  }
  next();
});

/** Thrown inside the purchase transaction when the user already owns the item. */
class AlreadyOwnedError extends Error {
  constructor() {
    super("تمتلك هذا العنصر بالفعل");
    this.name = "AlreadyOwnedError";
  }
}

/** Thrown inside the recharge transaction when the RC purchase was already redeemed. */
class AlreadyRedeemedError extends Error {
  constructor() {
    super("تم استخدام عملية الشراء هذه من قبل");
    this.name = "AlreadyRedeemedError";
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

router.get("/wallet/:userId", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const wallet = await ensureWallet(params.data.userId);
  res.json(GetWalletResponse.parse(toWalletView(wallet)));
});

router.post("/wallet/:userId/ensure", async (req, res): Promise<void> => {
  const params = EnsureWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // No client-supplied balances: the welcome amount is a fixed server constant
  // applied only on first wallet creation (see ensureWallet / WELCOME_COINS).
  const wallet = await ensureWallet(params.data.userId);
  res.json(EnsureWalletResponse.parse(toWalletView(wallet)));
});

// VIP activation is threshold-based (SUGO-style): the tier unlocks once the
// wallet's vPoints reach the tier's requirement. The check runs server-side so
// a client can never grant itself VIP status.
router.post("/wallet/:userId/vip", async (req, res): Promise<void> => {
  const params = ActivateVipParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ActivateVipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { level, type } = parsed.data;

  const [tier] = await db
    .select()
    .from(vipTiersTable)
    .where(
      and(
        eq(vipTiersTable.level, level),
        eq(vipTiersTable.type, type),
        eq(vipTiersTable.active, true),
      ),
    )
    .limit(1);
  if (!tier) {
    res.status(404).json({ error: "المستوى غير موجود" });
    return;
  }

  const wallet = await ensureWallet(params.data.userId);
  if (wallet.vPoints < tier.pointsRequired) {
    res.status(400).json({ error: "نقاطك غير كافية لهذا المستوى" });
    return;
  }

  const [updated] = await db
    .update(walletsTable)
    .set({ vipLevel: level, vipType: type })
    .where(eq(walletsTable.userId, params.data.userId))
    .returning();
  res.json(ActivateVipResponse.parse(toWalletView(updated)));
});

router.get("/wallet/:userId/transactions", async (req, res): Promise<void> => {
  const params = ListWalletTransactionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, params.data.userId))
    .orderBy(desc(walletTransactionsTable.createdAt), desc(walletTransactionsTable.id))
    .limit(200);
  res.json(
    ListWalletTransactionsResponse.parse(
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    ),
  );
});

router.post("/wallet/:userId/recharge", async (req, res): Promise<void> => {
  const params = RechargeWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = RechargeWalletBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const userId = params.data.userId;
  const { packageId, rcPurchaseId } = body.data;

  const [pkg] = await db
    .select()
    .from(coinPackagesTable)
    .where(eq(coinPackagesTable.id, packageId))
    .limit(1);
  if (!pkg || !pkg.active) {
    res.status(404).json({ error: "باقة الشحن غير متوفرة" });
    return;
  }
  if (!pkg.productId) {
    req.log.error({ packageId }, "Coin package has no productId");
    res.status(409).json({ error: "هذه الباقة غير مهيأة للشراء حالياً" });
    return;
  }

  await ensureWallet(userId);

  // Fast path: if this purchase was already redeemed, return the current wallet
  // without re-verifying or re-crediting. The unique rcPurchaseId guarantees a
  // purchase grants coins exactly once even under retries.
  const [existing] = await db
    .select()
    .from(rechargePurchasesTable)
    .where(eq(rechargePurchasesTable.rcPurchaseId, rcPurchaseId))
    .limit(1);
  if (existing) {
    if (existing.userId !== userId) {
      res.status(409).json({ error: "عملية الشراء هذه مرتبطة بحساب آخر" });
      return;
    }
    const wallet = await ensureWallet(userId);
    res.json(RechargeWalletResponse.parse(toWalletView(wallet)));
    return;
  }

  // Verify the purchase with RevenueCat before crediting anything. A
  // cancelled/failed/refunded or mismatched purchase grants nothing.
  let verified;
  try {
    verified = await verifyPurchase({
      userId,
      rcPurchaseId,
      expectedProductId: pkg.productId,
    });
  } catch (err) {
    if (err instanceof RevenueCatConfigError) {
      req.log.error({ err }, "RevenueCat verification unavailable");
      res
        .status(502)
        .json({ error: "تعذّر التحقق من عملية الدفع، حاول لاحقاً" });
      return;
    }
    throw err;
  }
  if (!verified) {
    res.status(402).json({
      error: "لم يتم تأكيد عملية الدفع. لم يتم خصم أي مبلغ ولم تُضف أي كوينز.",
    });
    return;
  }
  const confirmed = verified;

  const total = pkg.coins + pkg.bonus;
  try {
    // Record the redemption and credit coins atomically. The unique constraint
    // on rcPurchaseId is the idempotency guard: a concurrent duplicate insert
    // throws and rolls back, so the wallet is credited exactly once.
    const wallet = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(rechargePurchasesTable)
        .values({
          userId,
          rcPurchaseId: confirmed.rcPurchaseId,
          packageId: pkg.id,
          coinsGranted: total,
        })
        .onConflictDoNothing({ target: rechargePurchasesTable.rcPurchaseId })
        .returning();
      if (inserted.length === 0) {
        throw new AlreadyRedeemedError();
      }
      return adjustWalletTx(tx, {
        userId,
        currency: "coins",
        amount: total,
        type: "recharge",
        description: `شحن ${pkg.name || pkg.coins + " كوينز"}`,
        refId: confirmed.rcPurchaseId,
      });
    });
    res.json(RechargeWalletResponse.parse(toWalletView(wallet)));
  } catch (err) {
    if (err instanceof AlreadyRedeemedError) {
      // Lost an idempotency race; the coins were granted by the winner.
      const wallet = await ensureWallet(userId);
      res.json(RechargeWalletResponse.parse(toWalletView(wallet)));
      return;
    }
    throw err;
  }
});

router.post(
  "/wallet/:userId/recharge/reconcile",
  async (req, res): Promise<void> => {
    const params = ReconcileRechargesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = params.data.userId;
    await ensureWallet(userId);

    // Pull every owned purchase the store knows about for this customer, then
    // credit any that map to an active coin package and have not been redeemed.
    let owned;
    try {
      owned = await listOwnedPurchases(userId);
    } catch (err) {
      if (err instanceof RevenueCatConfigError) {
        req.log.error({ err }, "RevenueCat reconcile lookup unavailable");
        res
          .status(502)
          .json({ error: "تعذّر التحقق من عمليات الدفع، حاول لاحقاً" });
        return;
      }
      throw err;
    }

    if (owned.length > 0) {
      // Map active coin packages by their store productId so we know how many
      // coins each owned purchase is worth.
      const packages = await db
        .select()
        .from(coinPackagesTable)
        .where(eq(coinPackagesTable.active, true));
      const byProductId = new Map(
        packages.filter((p) => p.productId).map((p) => [p.productId, p]),
      );

      for (const purchase of owned) {
        const pkg = byProductId.get(purchase.productId);
        if (!pkg) continue;
        const total = pkg.coins + pkg.bonus;
        try {
          await db.transaction(async (tx) => {
            const inserted = await tx
              .insert(rechargePurchasesTable)
              .values({
                userId,
                rcPurchaseId: purchase.rcPurchaseId,
                packageId: pkg.id,
                coinsGranted: total,
              })
              .onConflictDoNothing({
                target: rechargePurchasesTable.rcPurchaseId,
              })
              .returning();
            // Already redeemed (by this user or a prior reconcile/recharge) —
            // skip crediting; the unique constraint keeps this exactly-once.
            if (inserted.length === 0) return;
            await adjustWalletTx(tx, {
              userId,
              currency: "coins",
              amount: total,
              type: "recharge",
              description: `شحن ${pkg.name || pkg.coins + " كوينز"}`,
              refId: purchase.rcPurchaseId,
            });
          });
        } catch (err) {
          // A purchase tied to another account collides on the unique id; log
          // and continue reconciling the rest rather than failing the request.
          req.log.warn(
            { err, rcPurchaseId: purchase.rcPurchaseId, userId },
            "Reconcile skipped a purchase",
          );
        }
      }
    }

    const wallet = await ensureWallet(userId);
    res.json(ReconcileRechargesResponse.parse(toWalletView(wallet)));
  },
);

router.post("/wallet/:userId/purchase", async (req, res): Promise<void> => {
  const params = PurchaseItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = PurchaseItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const userId = params.data.userId;
  const [item] = await db
    .select()
    .from(storeItemsTable)
    .where(eq(storeItemsTable.id, body.data.itemId))
    .limit(1);
  if (!item || !item.active) {
    res.status(404).json({ error: "العنصر غير متوفر" });
    return;
  }

  const [owned] = await db
    .select()
    .from(userItemsTable)
    .where(and(eq(userItemsTable.userId, userId), eq(userItemsTable.itemId, item.id)))
    .limit(1);
  if (owned) {
    res.status(400).json({ error: "تمتلك هذا العنصر بالفعل" });
    return;
  }

  await ensureWallet(userId);
  const currency: Currency = item.currency === "coins" ? "coins" : "V";
  try {
    // Ownership insert and debit happen in a single transaction. The unique
    // (userId, itemId) constraint is the idempotency guard: under concurrent
    // requests only one insert returns a row; the loser throws AlreadyOwned
    // and the transaction rolls back, so the wallet is never charged twice.
    const { wallet, userItem } = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(userItemsTable)
        .values({ userId, itemId: item.id, equipped: false })
        .onConflictDoNothing({
          target: [userItemsTable.userId, userItemsTable.itemId],
        })
        .returning();
      if (inserted.length === 0) {
        throw new AlreadyOwnedError();
      }
      const updatedWallet = await adjustWalletTx(tx, {
        userId,
        currency,
        amount: -item.price,
        type: "purchase",
        description: `شراء ${item.name}`,
        refId: String(item.id),
      });
      return { wallet: updatedWallet, userItem: inserted[0] };
    });
    res.json(
      PurchaseItemResponse.parse({
        wallet: toWalletView(wallet),
        item: {
          id: userItem.id,
          userId: userItem.userId,
          itemId: userItem.itemId,
          equipped: userItem.equipped,
        },
      }),
    );
  } catch (err) {
    if (err instanceof AlreadyOwnedError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof InsufficientBalanceError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/wallet/:userId/claim-task", async (req, res): Promise<void> => {
  const params = ClaimTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ClaimTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const userId = params.data.userId;
  const [task] = await db
    .select()
    .from(dailyTasksTable)
    .where(eq(dailyTasksTable.id, body.data.taskId))
    .limit(1);
  if (!task || !task.active) {
    res.status(404).json({ error: "المهمة غير متوفرة" });
    return;
  }

  const claimedOn = today();
  const inserted = await db
    .insert(dailyTaskClaimsTable)
    .values({ userId, taskId: task.id, claimedOn })
    .onConflictDoNothing({
      target: [
        dailyTaskClaimsTable.userId,
        dailyTaskClaimsTable.taskId,
        dailyTaskClaimsTable.claimedOn,
      ],
    })
    .returning();
  if (inserted.length === 0) {
    res.status(400).json({ error: "تم استلام مكافأة هذه المهمة اليوم" });
    return;
  }

  await ensureWallet(userId);
  const wallet = await adjustWallet({
    userId,
    currency: "coins",
    amount: task.reward,
    type: "task_reward",
    description: `مكافأة مهمة: ${task.label}`,
    refId: String(task.id),
  });
  res.json(ClaimTaskResponse.parse(toWalletView(wallet)));
});

router.get("/wallet/:userId/items", async (req, res): Promise<void> => {
  const params = ListUserItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(userItemsTable)
    .where(eq(userItemsTable.userId, params.data.userId))
    .orderBy(desc(userItemsTable.id));
  res.json(
    ListUserItemsResponse.parse(
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        itemId: r.itemId,
        equipped: r.equipped,
      })),
    ),
  );
});

router.post("/wallet/:userId/equip", async (req, res): Promise<void> => {
  const params = EquipItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = EquipItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const userId = params.data.userId;

  const [owned] = await db
    .select()
    .from(userItemsTable)
    .where(and(eq(userItemsTable.userId, userId), eq(userItemsTable.itemId, body.data.itemId)))
    .limit(1);
  if (!owned) {
    res.status(400).json({ error: "لا تمتلك هذا العنصر" });
    return;
  }

  const [targetItem] = await db
    .select()
    .from(storeItemsTable)
    .where(eq(storeItemsTable.id, body.data.itemId))
    .limit(1);

  // Find sibling store items of the same type, then unequip any owned ones.
  if (targetItem) {
    const sameType = await db
      .select({ id: storeItemsTable.id })
      .from(storeItemsTable)
      .where(eq(storeItemsTable.itemType, targetItem.itemType));
    const sameTypeIds = sameType.map((s) => s.id);
    if (sameTypeIds.length > 0) {
      await db
        .update(userItemsTable)
        .set({ equipped: false })
        .where(
          and(
            eq(userItemsTable.userId, userId),
            inArray(userItemsTable.itemId, sameTypeIds),
          ),
        );
    }
  }

  await db
    .update(userItemsTable)
    .set({ equipped: true })
    .where(and(eq(userItemsTable.userId, userId), eq(userItemsTable.itemId, body.data.itemId)));

  const rows = await db
    .select()
    .from(userItemsTable)
    .where(eq(userItemsTable.userId, userId))
    .orderBy(desc(userItemsTable.id));
  res.json(
    EquipItemResponse.parse(
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        itemId: r.itemId,
        equipped: r.equipped,
      })),
    ),
  );
});

router.get("/wallet/:userId/task-claims", async (req, res): Promise<void> => {
  const params = ListTaskClaimsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(dailyTaskClaimsTable)
    .where(
      and(
        eq(dailyTaskClaimsTable.userId, params.data.userId),
        eq(dailyTaskClaimsTable.claimedOn, today()),
      ),
    );
  res.json(
    ListTaskClaimsResponse.parse(
      rows.map((r) => ({ taskId: r.taskId, claimedOn: r.claimedOn })),
    ),
  );
});

export default router;
