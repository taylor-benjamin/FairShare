import { describe, expect, it } from "vitest";
import { hashPassword, passwordFingerprint, randomToken, signResetToken, signSession, verifyPassword, verifyResetToken, verifySession } from "@/lib/auth/crypto";

describe("password hashing (PBKDF2-SHA256)", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored).toMatch(/^pbkdf2_sha256\$100000\$/);
    expect(stored.length).toBeLessThanOrEqual(255);
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("uses a different salt every time", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "plaintext")).toBe(false);
  });
});

describe("session tokens", () => {
  const secret = "test-secret-test-secret-test-secret";

  it("round-trips a valid session", async () => {
    const token = await signSession({ uid: 42, exp: 2_000_000_000 }, secret);
    expect(await verifySession(token, secret, 1_000_000_000)).toEqual({ uid: 42, exp: 2_000_000_000 });
  });

  it("rejects tampered, expired, or wrongly-signed tokens", async () => {
    const token = await signSession({ uid: 42, exp: 2_000_000_000 }, secret);
    const [body, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ uid: 1, exp: 2_000_000_000 })).replace(/=+$/, "");
    expect(await verifySession(`${forged}.${sig}`, secret)).toBeNull();
    expect(await verifySession(token, "another-secret-another-secret-xx")).toBeNull();
    expect(await verifySession(token, secret, 2_000_000_001)).toBeNull();
    expect(await verifySession(body, secret)).toBeNull();
  });

  it("makes invite tokens that fit the 64-character column", () => {
    const t = randomToken();
    expect(t.length).toBeLessThanOrEqual(64);
    expect(t).not.toBe(randomToken());
  });
});

describe("password-reset tokens", () => {
  const secret = "test-secret-test-secret-test-secret";
  const hash = "pbkdf2_sha256$100000$salt$hash";

  it("round-trips for an hour and carries the password fingerprint", async () => {
    const now = 1_000_000_000;
    const token = await signResetToken(7, hash, secret, now);
    expect(await verifyResetToken(token, secret, now + 3599)).toEqual({ uid: 7, fp: await passwordFingerprint(hash) });
    expect(await verifyResetToken(token, secret, now + 3601)).toBeNull();
  });

  it("is single-use: a new password changes the fingerprint", async () => {
    expect(await passwordFingerprint(hash)).not.toBe(await passwordFingerprint(hash + "x"));
  });

  it("rejects a wrong secret, and can never be used as a session cookie", async () => {
    const token = await signResetToken(7, hash, secret);
    expect(await verifyResetToken(token, "another-secret-another-secret-xx")).toBeNull();
    expect(await verifySession(token, secret)).toBeNull();
  });

  it("rejects a session cookie used as a reset link", async () => {
    const session = await signSession({ uid: 7, exp: 2_000_000_000 }, secret);
    expect(await verifyResetToken(session, secret, 1_000_000_000)).toBeNull();
  });
});
