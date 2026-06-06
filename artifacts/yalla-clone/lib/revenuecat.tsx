import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import React, { createContext, useContext, useEffect } from "react";
import { Platform } from "react-native";
import Purchases, {
  PURCHASES_ERROR_CODE,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

// react-native-purchases ships native modules and is not available on web or in
// Expo Go (executionEnvironment "storeClient"). We treat those environments as
// "unavailable" so the app never crashes when a purchase is attempted there.
export const isPurchasesSupported =
  (Platform.OS === "ios" || Platform.OS === "android") &&
  Constants.executionEnvironment !== "storeClient";

// Tracks whether Purchases.configure() actually ran. Even on a supported native
// platform, a missing API key leaves the SDK unconfigured — in that case we keep
// the app running and treat purchases as unavailable rather than crashing.
let purchasesConfigured = false;

/**
 * Raised when the shopper backs out of the native purchase sheet. The caller
 * maps this to a neutral Arabic message and grants nothing.
 */
export class PurchaseCancelledError extends Error {
  constructor() {
    super("تم إلغاء عملية الشراء");
    this.name = "PurchaseCancelledError";
  }
}

/**
 * Raised when in-app purchases cannot run in the current environment (web /
 * Expo Go). Real purchases require a native build.
 */
export class PurchasesUnavailableError extends Error {
  constructor() {
    super("الشراء داخل التطبيق غير متاح في هذه البيئة");
    this.name = "PurchasesUnavailableError";
  }
}

/**
 * Raised when the store completed a purchase but did not return a unique
 * transaction id. The payment likely went through, so the caller should run
 * server-side reconciliation to credit it rather than treat it as a failure.
 */
export class MissingTransactionIdError extends Error {
  constructor() {
    super("تمت عملية الدفع لكن تعذّر تأكيدها فوراً، جارٍ التحقق…");
    this.name = "MissingTransactionIdError";
  }
}

// Resolves the API key for the current platform/build. Returns null (instead of
// throwing) when the key is missing so a misconfiguration degrades to "purchases
// unavailable" rather than crashing the whole app at startup.
function getRevenueCatApiKey(): string | null {
  if (__DEV__ || Platform.OS === "web") {
    return REVENUECAT_TEST_API_KEY ?? null;
  }
  if (Platform.OS === "ios") {
    return REVENUECAT_IOS_API_KEY ?? null;
  }
  if (Platform.OS === "android") {
    return REVENUECAT_ANDROID_API_KEY ?? null;
  }
  return REVENUECAT_TEST_API_KEY ?? null;
}

export function initializeRevenueCat(): void {
  if (!isPurchasesSupported) return;
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn(
      "RevenueCat API key is not set; in-app purchases are disabled for this build.",
    );
    return;
  }
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  purchasesConfigured = true;
}

function isCancelledError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; userCancelled?: unknown };
  return (
    e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    e.userCancelled === true
  );
}

/**
 * The result of a verified coin purchase. `rcPurchaseId` is the store
 * transaction identifier the server uses to look up and verify the purchase.
 */
export interface CoinPurchaseResult {
  rcPurchaseId: string;
  productId: string;
}

function useRevenueCatContext() {
  const { userId, isSignedIn } = useAuth();

  // Keep the RevenueCat customer id in lockstep with the Clerk user id so the
  // server can look the purchase up by the same id when verifying. This is a
  // proactive sync; purchaseByProductId additionally enforces login as a hard
  // precondition before charging anything.
  useEffect(() => {
    if (!isPurchasesSupported || !purchasesConfigured) return;
    if (isSignedIn && userId) {
      Purchases.logIn(userId).catch(() => {
        // Ignore here; the purchase flow re-runs logIn and fails hard if it
        // cannot bind the RevenueCat customer to this Clerk user.
      });
    }
  }, [isSignedIn, userId]);

  const offeringsQuery = useQuery<PurchasesOfferings | null>({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      if (!isPurchasesSupported || !purchasesConfigured) return null;
      return Purchases.getOfferings();
    },
    enabled: isPurchasesSupported && purchasesConfigured,
    staleTime: 300 * 1000,
  });

  const offerings = offeringsQuery.data ?? null;

  function findPackageByProductId(productId: string): PurchasesPackage | null {
    const current = offerings?.current;
    if (!current) return null;
    return (
      current.availablePackages.find(
        (p) => p.product.identifier === productId,
      ) ?? null
    );
  }

  async function purchaseByProductId(
    productId: string,
  ): Promise<CoinPurchaseResult> {
    if (!isPurchasesSupported || !purchasesConfigured) {
      throw new PurchasesUnavailableError();
    }

    // Hard precondition: the RevenueCat customer MUST be bound to this Clerk
    // user before we charge, otherwise the purchase lands on an anonymous
    // customer the server can never verify or credit. Fail before purchasing.
    if (!isSignedIn || !userId) {
      throw new Error("يجب تسجيل الدخول قبل الشراء");
    }
    try {
      await Purchases.logIn(userId);
    } catch {
      throw new Error("تعذّر ربط الحساب بالمتجر، حاول لاحقاً");
    }

    const offeringsData = offerings ?? (await Purchases.getOfferings());
    const pkg =
      offeringsData?.current?.availablePackages.find(
        (p) => p.product.identifier === productId,
      ) ?? null;

    if (!pkg) {
      throw new Error("الباقة غير متوفرة في المتجر حالياً");
    }

    const { transaction, productIdentifier } = await Purchases.purchasePackage(
      pkg,
    ).catch((err: unknown) => {
      if (isCancelledError(err)) {
        throw new PurchaseCancelledError();
      }
      throw err;
    });

    // Require a unique store transaction id. productIdentifier is NOT unique
    // (every purchase of the same package shares it) and must never be used as
    // the idempotency key — doing so would make a second purchase collide with
    // the first and silently grant nothing. If the store didn't return a
    // transaction id, surface it as a recoverable error and let reconciliation
    // credit the purchase from the server side instead.
    const rcPurchaseId = transaction?.transactionIdentifier;
    if (!rcPurchaseId) {
      throw new MissingTransactionIdError();
    }
    return { rcPurchaseId, productId: productIdentifier };
  }

  return {
    offerings,
    isOfferingsLoading: offeringsQuery.isLoading,
    isPurchasesSupported,
    findPackageByProductId,
    purchaseByProductId,
  };
}

type RevenueCatContextValue = ReturnType<typeof useRevenueCatContext>;
const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const value = useRevenueCatContext();
  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat(): RevenueCatContextValue {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    throw new Error("useRevenueCat must be used within a RevenueCatProvider");
  }
  return ctx;
}
