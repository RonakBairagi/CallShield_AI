import crypto from 'node:crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: 'Lead Investigator' | 'Forensic Analyst' | 'Citizen User';
  badgeNumber?: string;
  iat: number;
  exp: number;
}

const DEFAULT_JWT_SECRET =
  process.env.JWT_SECRET ||
  'callshield-ai-forensic-hmac-sha256-secret-key-2026-national-cyber';

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecodeToString(input: string): string {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

/**
 * Hashes a plaintext password using Node's cryptographic scrypt KDF with a 16-byte random salt.
 * Format: `scrypt$<saltHex>$<derivedKeyHex>`
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verifies a plaintext password against a stored `scrypt$salt$hash` string using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, originalHex] = parts;
  try {
    const derivedBuf = crypto.scryptSync(password, salt, 64);
    const originalBuf = Buffer.from(originalHex, 'hex');
    if (derivedBuf.length !== originalBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, originalBuf);
  } catch {
    return false;
  }
}

/**
 * Signs a standard RFC 7519 HS256 JWT token.
 */
export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresInSeconds = 86400,
  secret = DEFAULT_JWT_SECRET
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + expiresInSeconds,
  };

  const headerEncoded = base64UrlEncode(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  );
  const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest();
  const signatureEncoded = base64UrlEncode(signature);

  return `${signingInput}.${signatureEncoded}`;
}

/**
 * Verifies an HS256 JWT token signature and expiration using constant-time comparison.
 */
export function verifyJwt(
  token: string,
  secret = DEFAULT_JWT_SECRET
): { valid: boolean; payload?: JwtPayload; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing JWT token.' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT structure.' };
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest();
  const expectedSigEncoded = base64UrlEncode(expectedSig);

  const sigBufA = Buffer.from(signatureEncoded, 'utf8');
  const sigBufB = Buffer.from(expectedSigEncoded, 'utf8');

  if (
    sigBufA.length !== sigBufB.length ||
    !crypto.timingSafeEqual(sigBufA, sigBufB)
  ) {
    return { valid: false, error: 'Invalid JWT signature.' };
  }

  try {
    const decoded = JSON.parse(
      base64UrlDecodeToString(payloadEncoded)
    ) as JwtPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof decoded.exp !== 'number' || decoded.exp < nowSec) {
      return { valid: false, error: 'JWT token has expired.' };
    }
    return { valid: true, payload: decoded };
  } catch {
    return { valid: false, error: 'Invalid JWT payload JSON.' };
  }
}
