// @vitest-environment node
// jose checks `instanceof Uint8Array`, which fails across jsdom's separate JS
// realm. The session module only ever runs server-side (Node/edge), so we run
// its tests in the node environment to match production.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";

const original = { ...process.env };
const payload: SessionPayload = {
  playerId: "11111111-1111-1111-1111-111111111111",
  role: "user",
  name: "Acid",
};

beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
});
afterEach(() => {
  process.env = { ...original };
});

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips a payload", async () => {
    const token = await createSessionToken(payload);
    expect(token.split(".")).toHaveLength(3); // JWT shape
    expect(await verifySessionToken(token)).toMatchObject(payload);
  });

  it("returns null for a missing token", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken(null)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const token = await createSessionToken(payload);
    expect(await verifySessionToken(token + "x")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(payload);
    process.env.SESSION_SECRET = "a-completely-different-secret-value-9999";
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("throws a clear error when the secret is missing", async () => {
    delete process.env.SESSION_SECRET;
    await expect(createSessionToken(payload)).rejects.toThrow(/SESSION_SECRET/);
  });
});
