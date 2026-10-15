import { compare, genSalt, hash } from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cost factor for bcrypt. 12 is roughly 250ms on current hardware - slow enough to make
 * offline cracking expensive, fast enough that a login does not feel sluggish. Raise it
 * as hardware improves; existing hashes carry their own cost so they stay verifiable.
 */
const BCRYPT_ROUNDS = 12;

export async function hashSecret(plain: string): Promise<string> {
  return hash(plain, await genSalt(BCRYPT_ROUNDS));
}

export async function verifySecret(plain: string, hashed: string): Promise<boolean> {
  if (!plain || !hashed) return false;
  try {
    return await compare(plain, hashed);
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison.
 *
 * A plain `===` on strings short-circuits at the first differing byte, and the timing
 * difference is measurable over enough requests - enough to recover a signature or a
 * token byte by byte. Every secret comparison in this codebase goes through here.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a ?? '', 'utf8');
  const bufferB = Buffer.from(b ?? '', 'utf8');
  // timingSafeEqual throws on length mismatch, which itself would leak length. Compare
  // against a same-length buffer and fold the length check into the result.
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/** HMAC-SHA256 hex digest. Used for Razorpay signatures and webhook verification. */
export function hmacSha256(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyHmacSha256(payload: string, signature: string, secret: string): boolean {
  return safeCompare(hmacSha256(payload, secret), signature);
}
