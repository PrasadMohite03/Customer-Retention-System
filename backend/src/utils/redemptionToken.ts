import crypto from 'crypto';

export function getRedemptionSecret(): string {
  return (
    process.env.REDEMPTION_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    'retainpulse-redemption-token-secret-salt-2026'
  );
}

/**
 * Format 24 hex characters into the standard display format:
 * RP-XXXXXXXX-XXXXXXXX-XXXXXXXX (prefix + 3 groups of 8 hex chars)
 */
export function formatRedemptionToken(hex24: string): string {
  const clean = hex24.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 24);
  return `RP-${clean.slice(0, 8)}-${clean.slice(8, 16)}-${clean.slice(16, 24)}`;
}

/**
 * Generate a cryptographically random redemption token using crypto.randomBytes(12).
 * Format: RP-XXXXXXXX-XXXXXXXX-XXXXXXXX (24 uppercase hex chars from 12 random bytes)
 */
export function generateRandomRedemptionToken(): string {
  const raw = crypto.randomBytes(12).toString('hex');
  return formatRedemptionToken(raw);
}

/**
 * Deterministically derive the raw redemption token for a specific reward.
 * This allows returning the token to the authenticated customer on demand
 * while storing ONLY the SHA-256 hash in PostgreSQL.
 *
 * It uses HMAC-SHA256 with the server secret key, producing 96 bits of entropy
 * that are indistinguishable from random bytes to anyone without the secret key.
 */
export function deriveRedemptionTokenForReward(rewardId: string, attempt = 0): string {
  const payload = attempt === 0 ? rewardId : `${rewardId}:${attempt}`;
  const hmac = crypto.createHmac('sha256', getRedemptionSecret()).update(payload).digest('hex');
  return formatRedemptionToken(hmac.slice(0, 24));
}

/**
 * Compute deterministic SHA-256 hash of a redemption token.
 * Used for database storage and lookup.
 *
 * Normalizes case and trims whitespace so validation/lookup is robust.
 */
export function hashRedemptionToken(rawToken: string): string {
  const normalized = rawToken.trim().toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Validate the format of a redemption token.
 * Expected format: RP-XXXXXXXX-XXXXXXXX-XXXXXXXX (RP- prefix + 3 groups of 8 hex chars)
 */
export function isValidRedemptionTokenFormat(token: string): boolean {
  if (typeof token !== 'string') return false;
  return /^RP-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/i.test(token.trim());
}
