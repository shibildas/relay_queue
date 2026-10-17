export type EventStatus = 'QUEUED' | 'PROCESSING' | 'DELIVERED' | 'RETRYING' | 'DEAD_LETTER';

export interface DeliveryAttempt {
  attemptNumber: number;
  timestamp: string; // ISO 8601
  durationMs: number;
  statusCode?: number;
  error?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  backoffDelayMs?: number;
}

export interface RelayEvent {
  id: string; // e.g. evt_9x8f...
  idempotencyKey: string;
  destinationUrl: string;
  payload: Record<string, unknown> | string;
  headers: Record<string, string>;
  signature: string;
  timestamp: number;
  status: EventStatus;
  maxRetries: number;
  currentAttempt: number;
  nextRetryAt: number | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  attempts: DeliveryAttempt[];
  latencyMs?: number;
  deadLetterReason?: string;
  isReplay?: boolean;
  originalEventId?: string;
}

export interface QueueMetrics {
  totalEvents: number;
  delivered: number;
  deadLetter: number;
  retrying: number;
  queued: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  successRate: number;
}

export interface IngestEventRequest {
  destinationUrl: string;
  payload: Record<string, unknown> | string;
  idempotencyKey?: string;
  maxRetries?: number;
  secret?: string;
  headers?: Record<string, string>;
}

export interface IngestEventResponse {
  success: boolean;
  event: RelayEvent;
  isDuplicate?: boolean;
  message?: string;
}
