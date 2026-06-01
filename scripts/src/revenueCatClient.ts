import { createClient, createConfig, type Client } from "@replit/revenuecat-sdk/client";

/**
 * Build an authenticated RevenueCat v2 REST client from the project's secret
 * key (Replit secret `REVENUECAT_API_KEY`). This is the manual-key alternative
 * to the connector-based `getUncachableRevenueCatClient()` and is used by the
 * one-off seed script. The same construction is mirrored on the API server.
 */
export function getRevenueCatClient(): Client {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    throw new Error("REVENUECAT_API_KEY is not set");
  }
  return createClient(
    createConfig({
      baseUrl: "https://api.revenuecat.com/v2",
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  );
}
