// Password hashing and session signing with Web Crypto only (works in Workers, Node 20+, and browsers).

const enc = new TextEncoder();

// Cloudflare Workers cap PBKDF2 at 100,000 iterations.
export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, KEY_BITS);
  return new Uint8Array(bits);
}

/** Returns "pbkdf2_sha256$<iterations>$<salt>$<hash>" — the plaintext password is never stored. */
export async function hashPassword(password: string, saltOverride?: Uint8Array): Promise<string> {
  const salt = saltOverride ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  const expected = fromBase64Url(parts[3]);
  const actual = await pbkdf2(password, fromBase64Url(parts[2]), iterations);
  return timingSafeEqual(actual, expected);
}

// ── Signed session tokens ────────────────────────────────────────────────────

export interface SessionPayload {
  uid: number;
  exp: number; // unix seconds
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = toBase64Url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${toBase64Url(sig)}`;
}

export async function verifySession(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<SessionPayload | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(sig) as BufferSource, enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.uid !== "number" || typeof payload.exp !== "number" || payload.exp < nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}

/** URL-safe random token for invitation links (43 chars, fits VARCHAR(64)). */
export function randomToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}
