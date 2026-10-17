import crypto from 'crypto';

/**
 * Default secret used for mock signatures if none provided
 */
export const DEFAULT_WEBHOOK_SECRET = process.env.RELAY_WEBHOOK_SECRET || 'whsec_relayqueue_default_test_secret_key';

/**
 * Generates an HMAC-SHA256 signature for a payload with a timestamp.
 * Standard format: t={timestamp},v1={hex_digest}
 */
export function generateHmacSignature(
  payload: string | Record<string, unknown>,
  secret: string = DEFAULT_WEBHOOK_SECRET,
  timestamp: number = Date.now()
): { signature: string; headerValue: string; timestamp: number } {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedPayload);
  const digest = hmac.digest('hex');

  return {
    signature: digest,
    headerValue: `t=${timestamp},v1=${digest}`,
    timestamp,
  };
}

/**
 * Timing-safe HMAC signature verification to prevent timing attack vulnerabilities.
 * Validates timestamp to prevent replay attacks outside the allowed tolerance window.
 */
export function verifyHmacSignature(
  payload: string | Record<string, unknown>,
  headerValue: string,
  secret: string = DEFAULT_WEBHOOK_SECRET,
  toleranceSeconds: number = 300 // 5-minute replay window
): { valid: boolean; reason?: string } {
  try {
    if (!headerValue) {
      return { valid: false, reason: 'Missing signature header' };
    }

    // Parse header: t=1234567890,v1=abcdef...
    const parts = headerValue.split(',');
    let timestampStr: string | undefined;
    let signatureHex: string | undefined;

    for (const part of parts) {
      const [key, val] = part.trim().split('=');
      if (key === 't') timestampStr = val;
      if (key === 'v1') signatureHex = val;
    }

    if (!timestampStr || !signatureHex) {
      return { valid: false, reason: 'Malformed signature header format' };
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return { valid: false, reason: 'Invalid timestamp in signature' };
    }

    // Check tolerance window (replay attack mitigation)
    const now = Date.now();
    const ageSeconds = Math.abs(now - timestamp) / 1000;
    if (ageSeconds > toleranceSeconds) {
      return {
        valid: false,
        reason: `Timestamp outside tolerance window (${Math.round(ageSeconds)}s > ${toleranceSeconds}s)`,
      };
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedPayload = `${timestamp}.${payloadString}`;
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signedPayload);
    const expectedDigest = hmac.digest('hex');

    // Timing-safe comparison to prevent side-channel timing analysis
    const bufferA = Buffer.from(signatureHex, 'hex');
    const bufferB = Buffer.from(expectedDigest, 'hex');

    if (bufferA.length !== bufferB.length) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    const match = crypto.timingSafeEqual(bufferA, bufferB);
    return match ? { valid: true } : { valid: false, reason: 'Signature mismatch' };
  } catch (err: unknown) {
    return { valid: false, reason: `Verification exception: ${err instanceof Error ? err.message : 'Unknown'}` };
  }
}

/**
 * Computes deterministic SHA-256 fingerprint for automatic idempotency
 */
export function computePayloadDigest(payload: string | Record<string, unknown>): string {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(content).digest('hex');
}
