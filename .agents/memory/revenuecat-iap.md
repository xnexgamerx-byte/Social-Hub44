---
name: RevenueCat coin IAP (Viber Tok)
description: How real paid coin purchases work end-to-end and the non-obvious constraints around verification, idempotency, and environment support.
---

## Flow

Coin packages are real CONSUMABLE in-app purchases via RevenueCat. Each `coin_packages` row maps to a RevenueCat product through `coin_packages.productId` (the store identifier, e.g. `coins_1000`). Coins are credited ONLY after the server verifies the purchase.

1. Client (`artifacts/yalla-clone/lib/revenuecat.tsx`): `Purchases.logIn(clerkUserId)` so the RC customer id == Clerk user id. `purchaseByProductId()` finds the package in the current offering whose `product.identifier === productId`, runs `Purchases.purchasePackage`, returns the store `transactionIdentifier` as `rcPurchaseId`.
2. Client sends `{ packageId, rcPurchaseId }` to the recharge endpoint.
3. Server (`artifacts/api-server/src/lib/revenuecat.ts` + `routes/wallet.ts`): pages `listPurchases` for the customer, matches `rcPurchaseId` against `p.id` OR `p.store_purchase_identifier`, requires `product_id === pkg.productId` and `status === "owned"`, then atomically inserts `recharge_purchases` (unique `rcPurchaseId`, onConflictDoNothing) + credits the wallet ledger.

## Rules / constraints

- **Verify before credit, idempotent forever.** A given `rcPurchaseId` credits exactly once (unique constraint + onConflictDoNothing). Cancel/failure/refund-at-purchase grants nothing.
  **Why:** money. A retry, double-tap, or replayed id must never double-credit.
- **The idempotency key MUST be a unique store transaction id, never the product identifier.** `productIdentifier` (e.g. `coins_1000`) is shared by every purchase of that package, so using it as `rcPurchaseId` makes the buyer's 2nd purchase collide with their 1st and silently grant nothing. The client requires `transaction.transactionIdentifier`; if absent it raises `MissingTransactionIdError` (payment likely succeeded) and falls back to reconciliation rather than inventing a non-unique id.
- **`Purchases.logIn(clerkUserId)` is a HARD precondition for purchasing**, not best-effort. If the RC customer isn't bound to the Clerk user, the charge lands on an anonymous customer the server can never verify/credit → charged-without-coins. `purchaseByProductId` re-runs `logIn` and throws before purchasing if it fails.
- **Charged-but-uncredited recovery = server reconciliation.** `POST /wallet/:userId/recharge/reconcile` lists the customer's owned purchases at RevenueCat, maps `product_id`→active coin package, and idempotently credits any not already in the recharge ledger. The recharge screen calls it on mount and after a `MissingTransactionIdError`.
  **Why:** any gap between "store charged" and "server recorded" (app killed mid-flow, missing transaction id, network drop after purchase) would otherwise lose the buyer's coins.
- **react-native-purchases is native-only AND its native module does NOT exist in Expo Go.** `isPurchasesSupported` must check BOTH `Platform.OS` is ios/android AND `Constants.executionEnvironment !== "storeClient"` (storeClient == Expo Go). Checking `Platform.OS` alone is a startup-crash trap: Expo Go on Android reports `android`, so init proceeds and any RC native call / missing-key throw kills the whole app.
  **Why:** a past crash — `initializeRevenueCat()` runs at module top-level in `app/_layout.tsx`, so a throw there means `ClerkProvider` never mounts and you also get a misleading cascade error "useAuth can only be used within ClerkProvider". The RevenueCat throw is the real root cause; the Clerk error is a symptom.
  **How to apply:** never `throw` from RevenueCat init/key resolution at module load — return null + warn + skip configure, track a `purchasesConfigured` flag, and gate offerings/logIn/purchase on it. Test purchases on a dev/native build, not web preview or Expo Go.
- **Confirmation UI must be a custom Modal, not Alert.alert.** Per the RevenueCat skill, Alert can fail to show during the purchase flow. `recharge.tsx` uses custom confirm + result modals.
- **A refund AFTER coins are credited is NOT yet handled.** Verification happens once at purchase time; there is no webhook to claw back coins on a later refund/chargeback.

## RevenueCat secret env quirk (seeding)

- Updating an EXISTING secret's value does NOT propagate to running processes in the same session (the session-start snapshot wins). Adding a BRAND-NEW secret key DOES inject live. When a rotated key is needed for a script, add it under a new key name rather than overwriting.
