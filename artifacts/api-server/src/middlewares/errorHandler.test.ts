import express, { type Express, Router } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { errorHandler, notFoundHandler } from "./errorHandler";

let app: Express;

beforeAll(() => {
  const router = Router();

  router.get("/boom", () => {
    throw new Error("database exploded at line 42");
  });

  router.get("/boom-async", async () => {
    // Express 5 forwards a rejected async handler to the error middleware.
    throw new Error("await failed with a secret in the message");
  });

  router.post("/echo", (req, res) => {
    res.json({ ok: true, size: JSON.stringify(req.body).length });
  });

  router.get("/client-error", () => {
    const err = new Error("nope") as Error & { status: number };
    err.status = 403;
    throw err;
  });

  app = express();
  // A deliberately tiny limit, to exercise the body-too-large translation.
  app.use(express.json({ limit: "100b" }));
  app.use("/api", router);
  app.use("/api", notFoundHandler);
  app.use(errorHandler);
});

describe("unhandled errors", () => {
  it("answers JSON, not Express's HTML error page", async () => {
    const res = await request(app).get("/api/boom").expect(500);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.error).toBeTruthy();
  });

  it("never puts the stack or the message on the wire", async () => {
    const res = await request(app).get("/api/boom").expect(500);
    const body = JSON.stringify(res.body);
    // The default handler renders the stack into the response, which both
    // leaks internals and hands the app HTML where it expects { error }.
    expect(body).not.toContain("database exploded");
    expect(body).not.toContain("at Object");
    expect(body).not.toContain(".ts:");
  });

  it("catches a rejected async handler too", async () => {
    const res = await request(app).get("/api/boom-async").expect(500);
    expect(res.body.error).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});

describe("client mistakes", () => {
  it("explains an oversized body instead of failing opaquely", async () => {
    const res = await request(app)
      .post("/api/echo")
      .send({ padding: "x".repeat(500) })
      .expect(413);
    // The old 100 KB default rejected uploads with an unreadable HTML page,
    // which is how that limit stayed hidden for so long.
    expect(res.body.error).toContain("كبير");
  });

  it("accepts a body under the limit", async () => {
    await request(app).post("/api/echo").send({ a: 1 }).expect(200);
  });

  it("keeps the status a route asked for", async () => {
    const res = await request(app).get("/api/client-error").expect(403);
    expect(res.body.error).toBeTruthy();
  });
});

describe("unknown paths", () => {
  it("answers JSON for an unmatched API route", async () => {
    const res = await request(app).get("/api/no-such-route").expect(404);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.error).toBeTruthy();
  });
});
