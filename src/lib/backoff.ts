/**
 * Exponential Backoff with Full Jitter
 * Reference: AWS Architecture Blog - Exponential Backoff And Jitter
 * Formula: Sleep = rand(0, min(cap, base * 2 ^ attempt))
 */

export interface BackoffConfig {
  baseDelayMs: number; // Initial retry delay (e.g. 1000ms)
  maxDelayMs: number;  // Cap delay (e.g. 30000ms)
  factor: number;      // Exponential factor (typically 2)
  jitter: boolean;     // Whether to add full random jitter
}

export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  jitter: true,
};

export function calculateBackoffDelay(
  attempt: number,
  config: Partial<BackoffConfig> = {}
): number {
  const merged = { ...DEFAULT_BACKOFF_CONFIG, ...config };
  
  // Exponential delay: base * factor^(attempt - 1)
  const exponent = Math.max(0, attempt - 1);
  const calculatedDelay = merged.baseDelayMs * Math.pow(merged.factor, exponent);
  
  // Cap at max delay
  const cappedDelay = Math.min(merged.maxDelayMs, calculatedDelay);

  if (!merged.jitter) {
    return Math.round(cappedDelay);
  }

  // Full Jitter: random between [baseDelayMs/2, cappedDelay]
  // prevents all workers from retrying simultaneously (thundering herd problem)
  const minJitter = Math.min(merged.baseDelayMs / 2, cappedDelay / 2);
  const jitteredDelay = minJitter + Math.random() * (cappedDelay - minJitter);

  return Math.round(jitteredDelay);
}

/**
 * Returns formatted retry schedule preview for display in the developer cockpit
 */
export function getRetrySchedulePreview(
  maxRetries: number = 5,
  config: Partial<BackoffConfig> = {}
): Array<{ attempt: number; minDelayMs: number; maxDelayMs: number; theoreticalDelayMs: number }> {
  const merged = { ...DEFAULT_BACKOFF_CONFIG, ...config };
  const schedule = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const exponent = Math.max(0, attempt - 1);
    const calculated = merged.baseDelayMs * Math.pow(merged.factor, exponent);
    const capped = Math.min(merged.maxDelayMs, calculated);
    const minJitter = Math.min(merged.baseDelayMs / 2, capped / 2);

    schedule.push({
      attempt,
      minDelayMs: Math.round(minJitter),
      maxDelayMs: Math.round(capped),
      theoreticalDelayMs: Math.round(capped),
    });
  }

  return schedule;
}
