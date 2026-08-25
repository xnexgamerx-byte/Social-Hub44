import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isStorageConfigured } from "../lib/storage";

const router: IRouter = Router();

/**
 * Liveness plus which optional integrations are actually wired on this
 * deployment. Booleans only — a health endpoint must never echo a key, and
 * "is voice configured?" is otherwise unanswerable without a valid session.
 */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({
    status: "ok",
    voice: Boolean(process.env["AGORA_APP_ID"] && process.env["AGORA_APP_CERTIFICATE"]),
    storage: isStorageConfigured(),
  });
  res.json(data);
});

export default router;
