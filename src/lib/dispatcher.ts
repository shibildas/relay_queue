import { RelayEvent, DeliveryAttempt } from '@/types/queue';
import { calculateBackoffDelay } from './backoff';
import { eventStore } from './storage';

export interface DispatchOptions {
  timeoutMs?: number;
  autoProcessRetries?: boolean;
}

export class WebhookDispatcher {
  /**
   * Executes a dispatch attempt for an event
   */
  static async dispatch(
    event: RelayEvent,
    options: DispatchOptions = { timeoutMs: 5000, autoProcessRetries: true }
  ): Promise<RelayEvent> {
    const attemptNumber = event.currentAttempt + 1;
    event.currentAttempt = attemptNumber;
    event.status = 'PROCESSING';
    await eventStore.updateEvent(event);

    const startTime = Date.now();
    let attempt: DeliveryAttempt;

    try {
      // Mock receiver handler for testing & live dashboard demos
      if (
        event.destinationUrl.startsWith('mock://') ||
        event.destinationUrl.includes('/api/v1/mock-receiver')
      ) {
        attempt = await this.executeMockDispatch(event, attemptNumber);
      } else {
        // Real external HTTP dispatch
        attempt = await this.executeHttpDispatch(event, attemptNumber, startTime, options.timeoutMs || 5000);
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      attempt = {
        attemptNumber,
        timestamp: new Date().toISOString(),
        durationMs,
        error: err instanceof Error ? err.message : 'Unknown network failure',
      };
    }

    event.attempts.push(attempt);

    // Check if delivery was successful (2xx)
    const isSuccess = attempt.statusCode && attempt.statusCode >= 200 && attempt.statusCode < 300;

    if (isSuccess) {
      event.status = 'DELIVERED';
      event.deliveredAt = new Date().toISOString();
      event.latencyMs = attempt.durationMs;
      event.nextRetryAt = null;
    } else {
      // Failure path: evaluate retry policy or escalate to Dead Letter Queue (DLQ)
      if (attemptNumber < event.maxRetries) {
        const delayMs = calculateBackoffDelay(attemptNumber, { jitter: true });
        attempt.backoffDelayMs = delayMs;
        event.status = 'RETRYING';
        event.nextRetryAt = Date.now() + delayMs;

        // Auto-process retry if requested for interactive demo experience
        if (options.autoProcessRetries) {
          this.scheduleNextRetry(event.id, delayMs);
        }
      } else {
        // Retry budget exhausted -> Send to DLQ
        event.status = 'DEAD_LETTER';
        event.nextRetryAt = null;
        const errDetail = attempt.error || `HTTP ${attempt.statusCode}`;
        event.deadLetterReason = `Max retry budget exhausted (${event.maxRetries}/${event.maxRetries} attempts). Last failure: ${errDetail}`;
      }
    }

    await eventStore.updateEvent(event);
    return event;
  }

  /**
   * Dispatches a real external HTTP POST request with AbortController timeout
   */
  private static async executeHttpDispatch(
    event: RelayEvent,
    attemptNumber: number,
    startTime: number,
    timeoutMs: number
  ): Promise<DeliveryAttempt> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(event.destinationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-relay-event-id': event.id,
          'x-relay-idempotency-key': event.idempotencyKey,
          'x-relay-signature': event.signature,
          'x-relay-timestamp': String(event.timestamp),
          'x-relay-attempt': String(attemptNumber),
          'User-Agent': 'RelayQueue-Engine/1.0',
          ...event.headers,
        },
        body: typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      return {
        attemptNumber,
        timestamp: new Date().toISOString(),
        durationMs,
        statusCode: response.status,
        responseHeaders,
        responseBody: responseBody.slice(0, 1000), // cap to 1kb for memory safety
        error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;
      const isAbort = (err as Error)?.name === 'AbortError';
      return {
        attemptNumber,
        timestamp: new Date().toISOString(),
        durationMs,
        statusCode: isAbort ? 504 : 500,
        error: isAbort ? `Dispatch timed out after ${timeoutMs}ms` : (err as Error)?.message || 'Fetch error',
      };
    }
  }

  /**
   * Mock receiver simulator for immediate offline / interactive UI testing
   */
  private static async executeMockDispatch(
    event: RelayEvent,
    attemptNumber: number
  ): Promise<DeliveryAttempt> {
    // Artificial latency between 40ms and 180ms
    const simulatedLatency = Math.floor(40 + Math.random() * 120);
    await new Promise((resolve) => setTimeout(resolve, simulatedLatency));

    const url = event.destinationUrl.toLowerCase();

    // 1. Force 500 Error
    if (url.includes('error-500') || url.includes('scenario=500')) {
      return {
        attemptNumber,
        timestamp: new Date().toISOString(),
        durationMs: simulatedLatency,
        statusCode: 500,
        error: 'HTTP 500 Internal Server Error: Database deadlock encountered',
        responseBody: '{"status":"error","code":"DEADLOCK_DETECTED","retryable":true}',
      };
    }

    // 2. Force 504 Timeout
    if (url.includes('timeout-504') || url.includes('scenario=504')) {
      return {
        attemptNumber,
        timestamp: new Date().toISOString(),
        durationMs: simulatedLatency + 200,
        statusCode: 504,
        error: 'HTTP 504 Gateway Timeout: Upstream destination service did not respond within 3000ms',
        responseBody: '{"status":"error","code":"GATEWAY_TIMEOUT"}',
      };
    }

    // 3. Flaky Receiver: Fails attempt 1 & 2 with 500, succeeds on attempt 3!
    // Perfect for showcasing backoff and automatic recovery
    if (url.includes('flaky') || url.includes('scenario=flaky')) {
      if (attemptNumber < 3) {
        return {
          attemptNumber,
          timestamp: new Date().toISOString(),
          durationMs: simulatedLatency,
          statusCode: 500,
          error: `HTTP 500 Flaky Destination Failure (Attempt ${attemptNumber})`,
          responseBody: JSON.stringify({
            status: 'transient_failure',
            attempt: attemptNumber,
            message: 'Server warming up; please retry with backoff',
          }),
        };
      } else {
        return {
          attemptNumber,
          timestamp: new Date().toISOString(),
          durationMs: simulatedLatency,
          statusCode: 200,
          responseBody: JSON.stringify({
            status: 'success',
            attempt: attemptNumber,
            message: 'Successfully recovered after backoff retries!',
          }),
        };
      }
    }

    // Default: 200 OK
    return {
      attemptNumber,
      timestamp: new Date().toISOString(),
      durationMs: simulatedLatency,
      statusCode: 200,
      responseBody: JSON.stringify({
        status: 'ok',
        receivedAt: new Date().toISOString(),
        ack: true,
      }),
    };
  }

  /**
   * Schedules next retry in the background with simulated fast-forward for interactive demos
   */
  private static scheduleNextRetry(eventId: string, delayMs: number): void {
    // For local interactive demo responsiveness, cap simulation wait to 10 seconds max
    const waitTime = Math.min(delayMs, 8000);
    setTimeout(async () => {
      try {
        const ev = await eventStore.getEvent(eventId);
        if (ev && ev.status === 'RETRYING') {
          await this.dispatch(ev, { timeoutMs: 5000, autoProcessRetries: true });
        }
      } catch (err) {
        console.error('Error during scheduled retry execution:', err);
      }
    }, waitTime);
  }

  /**
   * Replays an event from the Dead-Letter Queue (DLQ)
   */
  static async replayDlqEvent(eventId: string): Promise<RelayEvent> {
    const existing = await eventStore.getEvent(eventId);
    if (!existing) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Reset retry counters and mark as replayed
    existing.status = 'QUEUED';
    existing.currentAttempt = 0;
    existing.deadLetterReason = undefined;
    existing.isReplay = true;
    existing.updatedAt = new Date().toISOString();

    // Mark previous attempts with historical note
    const replayedEvent = await this.dispatch(existing, { timeoutMs: 5000, autoProcessRetries: true });
    return replayedEvent;
  }
}
