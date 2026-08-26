import { getRevenueCatClient } from "./revenueCatClient";
import { db, pool, coinPackagesTable } from "@workspace/db";

import {
  listProjects,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

// The RevenueCat project is created by the user in the dashboard. We never
// create it here — we locate the existing one (by name, else the only project).
const PROJECT_NAME = "Viber Tok";

const APP_STORE_APP_NAME = "Viber Tok iOS";
const APP_STORE_BUNDLE_ID = "com.nabda.yalla";
const PLAY_STORE_APP_NAME = "Viber Tok Android";
const PLAY_STORE_PACKAGE_NAME = "com.nabda.yalla";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "باقات الكوينز";

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

/** Parse a display price label like "$0.99" or "9.99 ر.س" into micros. */
function priceToMicros(label: string): number {
  const match = label.replace(/,/g, "").match(/[0-9]+(\.[0-9]+)?/);
  const amount = match ? parseFloat(match[0]) : 0;
  return Math.round(amount * 1_000_000);
}

async function seedRevenueCat() {
  const client = getRevenueCatClient();

  const tiers = (await db.select().from(coinPackagesTable)).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
  );

  const consumableTiers = tiers.filter((t) => t.productId.trim().length > 0);
  if (consumableTiers.length === 0) {
    throw new Error("No coin packages with a productId found to seed");
  }
  console.log(`Seeding ${consumableTiers.length} coin tiers`);

  // ---- Project (must already exist) --------------------------------------
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  const projects = existingProjects.items ?? [];
  let project: Project | undefined = projects.find((p) => p.name === PROJECT_NAME);
  if (!project && projects.length === 1) project = projects[0];
  if (!project) {
    throw new Error(
      `Could not resolve RevenueCat project. Found: ${projects
        .map((p) => `${p.name} (${p.id})`)
        .join(", ")}`,
    );
  }
  console.log("Using project:", project.name, project.id);

  // ---- Apps (test store auto-exists; create app/play store if missing) ----
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps) throw new Error("Failed to list apps");

  const testStoreApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testStoreApp) {
    throw new Error("No Test Store app found in project (it should be auto-provisioned)");
  }
  console.log("Test Store app:", testStoreApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app:", playStoreApp.id);
  }

  // ---- Products (consumable, one per tier per store) ----------------------
  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 200 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    storeIdentifier: string,
    displayName: string,
    isTestStore: boolean,
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === storeIdentifier && p.app_id === targetApp.id,
    );
    if (existing) {
      console.log(`  ${label} product exists:`, existing.id);
      return existing;
    }
    const body: CreateProductData["body"] = {
      store_identifier: storeIdentifier,
      app_id: targetApp.id,
      type: "consumable",
      display_name: displayName,
    };
    if (isTestStore) {
      // Test Store products require a user-facing title.
      body.title = displayName;
    }
    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) {
      throw new Error(
        `Failed to create ${label} product ${storeIdentifier}: ${JSON.stringify(error)}`,
      );
    }
    console.log(`  Created ${label} product:`, created.id);
    return created;
  };

  // ---- Offering (single "default", set current) --------------------------
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  let offering: Offering | undefined = existingOfferings.items?.find(
    (o) => o.lookup_key === OFFERING_IDENTIFIER,
  );
  if (offering) {
    console.log("Offering exists:", offering.id);
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    offering = newOffering;
    console.log("Created offering:", offering.id);
  }
  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 50 },
  });
  if (listPackagesError) throw new Error("Failed to list packages");

  // ---- Per-tier: products, prices, package ------------------------------
  for (const tier of consumableTiers) {
    const productId = tier.productId.trim();
    const displayName = tier.name || `${tier.coins} كوينز`;
    console.log(`\nTier ${productId} (${displayName}) — ${tier.price}`);

    const testProduct = await ensureProduct(testStoreApp, "Test Store", productId, displayName, true);
    const appProduct = await ensureProduct(appStoreApp, "App Store", productId, displayName, false);
    const playProduct = await ensureProduct(playStoreApp, "Play Store", productId, displayName, false);

    // Test store prices via the undocumented endpoint.
    const prices = [{ amount_micros: priceToMicros(tier.price), currency: "USD" }];
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testProduct.id },
      body: { prices },
    });
    if (priceError) {
      if (
        typeof priceError === "object" &&
        priceError !== null &&
        "type" in priceError &&
        (priceError as { type?: string }).type === "resource_already_exists"
      ) {
        console.log("  Test store price already set");
      } else {
        throw new Error(`Failed to set test store price: ${JSON.stringify(priceError)}`);
      }
    } else {
      console.log(`  Set test store price: $${(prices[0].amount_micros / 1e6).toFixed(2)}`);
    }

    // One package per tier inside the default offering.
    let pkg: Package | undefined = existingPackages.items?.find(
      (p) => p.lookup_key === productId,
    );
    if (pkg) {
      console.log("  Package exists:", pkg.id);
    } else {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: productId, display_name: displayName },
      });
      if (error) throw new Error(`Failed to create package ${productId}`);
      pkg = newPkg;
      console.log("  Created package:", pkg.id);
    }

    const { error: attachError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: testProduct.id, eligibility_criteria: "all" },
          { product_id: appProduct.id, eligibility_criteria: "all" },
          { product_id: playProduct.id, eligibility_criteria: "all" },
        ],
      },
    });
    if (attachError) {
      if (
        attachError.type === "unprocessable_entity_error" &&
        attachError.message?.includes("Cannot attach")
      ) {
        console.log("  Skipping attach: incompatible product already attached");
      } else if (attachError.type === "unprocessable_entity_error") {
        console.log("  Products already attached to package");
      } else {
        throw new Error(`Failed to attach products to package: ${JSON.stringify(attachError)}`);
      }
    } else {
      console.log("  Attached products to package");
    }
  }

  // ---- Public API keys ---------------------------------------------------
  const keysFor = async (appId: string, label: string): Promise<string> => {
    const { data, error } = await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: appId },
    });
    if (error) throw new Error(`Failed to list public API keys for ${label}`);
    return data?.items.map((i) => i.key).join(", ") ?? "N/A";
  };
  const testKey = await keysFor(testStoreApp.id, "Test Store");
  const appKey = await keysFor(appStoreApp.id, "App Store");
  const playKey = await keysFor(playStoreApp.id, "Play Store");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("REVENUECAT_PROJECT_ID:", project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID:", testStoreApp.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID:", appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID:", playStoreApp.id);
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:", testKey);
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:", appKey);
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:", playKey);
  console.log("====================\n");

  await pool.end();
}

seedRevenueCat().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
