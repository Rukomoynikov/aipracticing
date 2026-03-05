import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generateToken } from "./auth";

describe("hashPassword / verifyPassword", () => {
  it("verifies the correct password", async () => {
    const hash = await hashPassword("mySecurePass1");
    expect(await verifyPassword("mySecurePass1", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("mySecurePass1");
    expect(await verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("returns false for a corrupted / non-base64 hash", async () => {
    expect(await verifyPassword("anything", "!!!not-base64!!!")).toBe(false);
  });

  it("returns false for a hash that is too short (missing hash bytes)", async () => {
    // Valid base64 but too short to contain salt + hash
    const tooShort = btoa("tooshort");
    expect(await verifyPassword("anything", tooShort)).toBe(false);
  });

  it("two hashes of the same password differ (unique salts)", async () => {
    const [h1, h2] = await Promise.all([
      hashPassword("samepassword"),
      hashPassword("samepassword"),
    ]);
    expect(h1).not.toBe(h2);
  });

  it("does not verify when hash bytes are tampered", async () => {
    const hash = await hashPassword("original");
    // flip last character
    const tampered = hash.slice(0, -1) + (hash.endsWith("A") ? "B" : "A");
    expect(await verifyPassword("original", tampered)).toBe(false);
  });
});

describe("generateToken", () => {
  it("returns a 64-character lowercase hex string", () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(tokens.size).toBe(200);
  });
});
