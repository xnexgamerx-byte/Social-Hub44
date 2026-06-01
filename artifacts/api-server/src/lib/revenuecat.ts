import {
  createClient,
  createConfig,
  type Client,
} from "@replit/revenuecat-sdk/client";
import { listPurchases } from "@replit/revenuecat-sdk";
import { logger } from "./logger";

/**
 * Build an authenticated RevenueCat v2 REST client from the project's secret
 * key. The v2 API requires a *secret* key (starts with "sk_"); we prefer the
 * dedicated REVENUECAT_SECRET_KEY and fall back to REVENUECAT_API_KEY.
 */
function getRevenueCatClient(): Client {
  const apiKey = (
    process.env.REVENUECAT_SECRET_KEY ||
    process.env.REVENUECAT_API_KEY ||
    ""
  ).trim();
  if (!apiKey) {
    throw new Error("REVENUECAT_SECRET_KEY is not set");
  }
  return createClient(
    createConfig({
      baseUrl: "https://api.revenuecat.com/v2",
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  );
}

export class RevenueCatConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevenueCatConfigError";
  }
}

/** Result of verifying a client-reported purchase against RevenueCat. */
export interface VerifiedPurchase {
  /** The canonical RevenueCat purchase id used as the idempotency key. */
  rcPurchaseId: string;
  productId: string;
}

/**
 * Verify that `rcPurchaseId` corresponds to a real, owned (non-refunded)
 * purchase of `expectedProductId` made by `userId` (the RevenueCat customer id).
 *
 * Returns the verified purchase on success, or `null` when no matching owned
 * purchase exists (cancelled, failed, refunded, mismatched product, or unknown
 * id) — the caller must grant nothing in that case.
 *
 * The client may report either the RevenueCat purchase id or the underlying
 * store transaction id, so we match against both. The returned `rcPurchaseId`
 * is always the canonical RevenueCat purchase id, which becomes the idempotency
 * key for crediting.
 */
export async function verifyPurchase(params: {
  userId: string;
  rcPurchaseId: string;
  expectedProductId: string;
}): Promise<VerifiedPurchase | null> {
  const { userId, rcPurchaseId, expectedProductId } = params;
  const projectId = (process.env.REVENUECAT_PROJECT_ID || "").trim();
  if (!projectId) {
    throw new RevenueCatConfigError("REVENUECAT_PROJECT_ID is not set");
  }

  const client = getRevenueCatClient();

  // Page through the customer's purchases until we find a match or run out.
  let startingAfter: string | undefined = undefined;
  for (let page = 0; page < 20; page++) {
    const query: { limit: number; starting_after?: string } = { limit: 50 };
    if (startingAfter) query.starting_after = startingAfter;
    const result = await listPurchases({
      client,
      path: { project_id: projectId, customer_id: userId },
      query,
    });
    if (result.error) {
      logger.error({ err: result.error, userId }, "RevenueCat listPurchases failed");
      throw new RevenueCatConfigError("RevenueCat purchase lookup failed");
    }
    const data = result.data;
    const items = data?.items ?? [];
    for (const p of items) {
      const matchesId =
        p.id === rcPurchaseId || p.store_purchase_identifier === rcPurchaseId;
      if (!matchesId) continue;
      if (p.product_id !== expectedProductId) {
        logger.warn(
          { userId, rcPurchaseId, expected: expectedProductId, got: p.product_id },
          "Purchase product mismatch",
        );
        return null;
      }
      if (p.status !== "owned") {
        logger.warn(
          { userId, rcPurchaseId, status: p.status },
          "Purchase not owned (refunded/cancelled)",
        );
        return null;
      }
      return { rcPurchaseId: p.id, productId: p.product_id };
    }
    if (!data?.next_page || items.length === 0) break;
    startingAfter = items[items.length - 1]?.id;
    if (!startingAfter) break;
  }

  return null;
}

/** An owned purchase belonging to a customer, used for reconciliation. */
export interface OwnedPurchase {
  /** The canonical RevenueCat purchase id (idempotency key for crediting). */
  rcPurchaseId: string;
  productId: string;
}

/**
 * List every currently-owned (non-refunded, non-cancelled) purchase for
 * `userId`. Used by the reconciliation path to credit purchases that were
 * charged by the store but never recorded (e.g. the app closed before the
 * recharge call landed). Crediting decisions are still made by the caller by
 * matching `productId` against active coin packages and the recharge ledger.
 */
export async function listOwnedPurchases(userId: string): Promise<OwnedPurchase[]> {
  const projectId = (process.env.REVENUECAT_PROJECT_ID || "").trim();
  if (!projectId) {
    throw new RevenueCatConfigError("REVENUECAT_PROJECT_ID is not set");
  }

  const client = getRevenueCatClient();
  const owned: OwnedPurchase[] = [];

  let startingAfter: string | undefined = undefined;
  for (let page = 0; page < 20; page++) {
    const query: { limit: number; starting_after?: string } = { limit: 50 };
    if (startingAfter) query.starting_after = startingAfter;
    const result = await listPurchases({
      client,
      path: { project_id: projectId, customer_id: userId },
      query,
    });
    if (result.error) {
      logger.error({ err: result.error, userId }, "RevenueCat listPurchases failed");
      throw new RevenueCatConfigError("RevenueCat purchase lookup failed");
    }
    const data = result.data;
    const items = data?.items ?? [];
    for (const p of items) {
      if (p.status === "owned" && p.id && p.product_id) {
        owned.push({ rcPurchaseId: p.id, productId: p.product_id });
      }
    }
    if (!data?.next_page || items.length === 0) break;
    startingAfter = items[items.length - 1]?.id;
    if (!startingAfter) break;
  }

  return owned;
}
