import { RelayEvent, QueueMetrics, EventStatus } from '@/types/queue';
import { Redis } from '@upstash/redis';

export interface IEventStore {
  saveEvent(event: RelayEvent): Promise<void>;
  getEvent(id: string): Promise<RelayEvent | null>;
  getEventByIdempotencyKey(key: string): Promise<RelayEvent | null>;
  listEvents(filter?: { status?: EventStatus; limit?: number; search?: string }): Promise<RelayEvent[]>;
  updateEvent(event: RelayEvent): Promise<void>;
  getMetrics(): Promise<QueueMetrics>;
  clearAll(): Promise<void>;
  seedDemoData(): Promise<void>;
  isRedisConnected(): boolean;
}

// Global in-memory cache preserved across hot-reloads
declare global {
  var __relayEventQueue: Map<string, RelayEvent> | undefined;
  var __relayEventIdempotencyMap: Map<string, string> | undefined;
}

class InMemoryEventStore implements IEventStore {
  private events: Map<string, RelayEvent>;
  private idempotencyMap: Map<string, string>; // idempotencyKey -> eventId
  private redisClient: Redis | null = null;
  private redisEnabled: boolean = false;

  constructor() {
    if (!global.__relayEventQueue) {
      global.__relayEventQueue = new Map<string, RelayEvent>();
    }
    if (!global.__relayEventIdempotencyMap) {
      global.__relayEventIdempotencyMap = new Map<string, string>();
    }
    this.events = global.__relayEventQueue;
    this.idempotencyMap = global.__relayEventIdempotencyMap;

    // Check for Upstash Redis environment variables
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        this.redisClient = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        this.redisEnabled = true;
      } catch (err) {
        console.warn('Failed to initialize Upstash Redis, falling back to in-memory store:', err);
      }
    }

    // Auto-seed if empty
    if (this.events.size === 0) {
      this.seedInitialDemoEvents();
    }
  }

  isRedisConnected(): boolean {
    return this.redisEnabled && this.redisClient !== null;
  }

  async saveEvent(event: RelayEvent): Promise<void> {
    this.events.set(event.id, event);
    this.idempotencyMap.set(event.idempotencyKey, event.id);

    if (this.redisClient) {
      try {
        await this.redisClient.set(`event:${event.id}`, JSON.stringify(event));
        await this.redisClient.set(`idemp:${event.idempotencyKey}`, event.id, { ex: 86400 * 7 });
        await this.redisClient.lpush('events:index', event.id);
      } catch (e) {
        console.error('Redis save error:', e);
      }
    }
  }

  async getEvent(id: string): Promise<RelayEvent | null> {
    if (this.redisClient) {
      try {
        const data = await this.redisClient.get<string>(`event:${id}`);
        if (data) return typeof data === 'string' ? JSON.parse(data) : data;
      } catch (e) {
        console.error('Redis get error:', e);
      }
    }
    return this.events.get(id) || null;
  }

  async getEventByIdempotencyKey(key: string): Promise<RelayEvent | null> {
    const eventId = this.idempotencyMap.get(key);
    if (eventId) {
      return this.getEvent(eventId);
    }
    if (this.redisClient) {
      try {
        const idFromRedis = await this.redisClient.get<string>(`idemp:${key}`);
        if (idFromRedis) {
          return this.getEvent(idFromRedis);
        }
      } catch (e) {
        console.error('Redis idempotency lookup error:', e);
      }
    }
    return null;
  }

  async listEvents(filter?: { status?: EventStatus; limit?: number; search?: string }): Promise<RelayEvent[]> {
    let list = Array.from(this.events.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filter?.status) {
      list = list.filter((e) => e.status === filter.status);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.idempotencyKey.toLowerCase().includes(q) ||
          e.destinationUrl.toLowerCase().includes(q)
      );
    }

    if (filter?.limit && filter.limit > 0) {
      list = list.slice(0, filter.limit);
    }

    return list;
  }

  async updateEvent(event: RelayEvent): Promise<void> {
    event.updatedAt = new Date().toISOString();
    this.events.set(event.id, event);

    if (this.redisClient) {
      try {
        await this.redisClient.set(`event:${event.id}`, JSON.stringify(event));
      } catch (e) {
        console.error('Redis update error:', e);
      }
    }
  }

  async getMetrics(): Promise<QueueMetrics> {
    const all = Array.from(this.events.values());
    const total = all.length;
    let delivered = 0;
    let deadLetter = 0;
    let retrying = 0;
    let queued = 0;
    const latencies: number[] = [];

    for (const ev of all) {
      if (ev.status === 'DELIVERED') {
        delivered++;
        if (ev.latencyMs !== undefined) {
          latencies.push(ev.latencyMs);
        }
      } else if (ev.status === 'DEAD_LETTER') {
        deadLetter++;
      } else if (ev.status === 'RETRYING') {
        retrying++;
      } else if (ev.status === 'QUEUED') {
        queued++;
      }
    }

    latencies.sort((a, b) => a - b);
    const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    const p50Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;

    const finished = delivered + deadLetter;
    const successRate = finished > 0 ? Math.round((delivered / finished) * 1000) / 10 : 100;

    return {
      totalEvents: total,
      delivered,
      deadLetter,
      retrying,
      queued,
      avgLatencyMs,
      p50Ms,
      p95Ms,
      p99Ms,
      successRate,
    };
  }

  async clearAll(): Promise<void> {
    this.events.clear();
    this.idempotencyMap.clear();
    if (this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch (e) {
        console.error('Redis flush error:', e);
      }
    }
  }

  async seedDemoData(): Promise<void> {
    this.events.clear();
    this.idempotencyMap.clear();
    this.seedInitialDemoEvents();
  }

  private seedInitialDemoEvents(): void {
    const now = Date.now();

    // 1. Successful payment webhook
    const ev1: RelayEvent = {
      id: 'evt_stripe_98f12a',
      idempotencyKey: 'idemp_payment_ch_3M4K8L99x',
      destinationUrl: 'https://api.yourdomain.com/webhooks/stripe',
      payload: {
        id: 'evt_1M7XYZ2eZvKYlo2C',
        type: 'payment_intent.succeeded',
        amount: 24900,
        currency: 'inr',
        customer: 'cus_N8yV1a4X',
      },
      headers: {
        'x-relay-signature': 't=1729160000,v1=9e7bc211f4d998a44c9b1f09c81',
        'content-type': 'application/json',
      },
      signature: '9e7bc211f4d998a44c9b1f09c81',
      timestamp: now - 3600000,
      status: 'DELIVERED',
      maxRetries: 3,
      currentAttempt: 1,
      nextRetryAt: null,
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 3600000 + 145).toISOString(),
      deliveredAt: new Date(now - 3600000 + 145).toISOString(),
      latencyMs: 145,
      attempts: [
        {
          attemptNumber: 1,
          timestamp: new Date(now - 3600000).toISOString(),
          durationMs: 145,
          statusCode: 200,
          responseBody: '{"received":true}',
        },
      ],
    };

    // 2. Dead-Letter Queue event (exhausted retries on 500 error)
    const ev2: RelayEvent = {
      id: 'evt_dlq_hdfc_441c8e',
      idempotencyKey: 'idemp_order_hdfc_tx_901824',
      destinationUrl: 'https://api.yourdomain.com/webhooks/hdfc-smartgateway',
      payload: {
        transaction_id: 'HDFC_TX_89201',
        status: 'CHARGED',
        amount: 1450000,
        currency: 'INR',
        merchant_id: 'MERCH_PACKAPEER_01',
      },
      headers: {
        'x-relay-signature': 't=1729158000,v1=c58fa39109bc12e9944a9',
        'content-type': 'application/json',
      },
      signature: 'c58fa39109bc12e9944a9',
      timestamp: now - 1800000,
      status: 'DEAD_LETTER',
      maxRetries: 3,
      currentAttempt: 3,
      nextRetryAt: null,
      createdAt: new Date(now - 1800000).toISOString(),
      updatedAt: new Date(now - 1765000).toISOString(),
      deadLetterReason: 'Max retry attempts (3) exceeded. Upstream returned HTTP 500 Internal Server Error: Database pool exhausted',
      attempts: [
        {
          attemptNumber: 1,
          timestamp: new Date(now - 1800000).toISOString(),
          durationMs: 310,
          statusCode: 500,
          error: 'HTTP 500 Internal Server Error',
          responseBody: '{"error":"Connection refused to postgres-read-replica"}',
          backoffDelayMs: 1200,
        },
        {
          attemptNumber: 2,
          timestamp: new Date(now - 1798500).toISOString(),
          durationMs: 420,
          statusCode: 500,
          error: 'HTTP 500 Internal Server Error',
          responseBody: '{"error":"Connection refused to postgres-read-replica"}',
          backoffDelayMs: 2850,
        },
        {
          attemptNumber: 3,
          timestamp: new Date(now - 1765000).toISOString(),
          durationMs: 512,
          statusCode: 500,
          error: 'HTTP 500 Internal Server Error',
          responseBody: '{"error":"Connection refused to postgres-read-replica"}',
        },
      ],
    };

    // 3. Retrying Event (currently in backoff jitter window)
    const ev3: RelayEvent = {
      id: 'evt_retry_shopify_3389a',
      idempotencyKey: 'idemp_shopify_order_create_8829',
      destinationUrl: 'https://api.yourdomain.com/webhooks/shopify',
      payload: {
        id: 82098291794,
        topic: 'orders/create',
        total_price: '89.00',
        currency: 'USD',
      },
      headers: {
        'x-relay-signature': 't=1729161000,v1=f1004a89bce8227189d',
        'content-type': 'application/json',
      },
      signature: 'f1004a89bce8227189d',
      timestamp: now - 120000,
      status: 'RETRYING',
      maxRetries: 4,
      currentAttempt: 2,
      nextRetryAt: now + 45000,
      createdAt: new Date(now - 120000).toISOString(),
      updatedAt: new Date(now - 118000).toISOString(),
      attempts: [
        {
          attemptNumber: 1,
          timestamp: new Date(now - 120000).toISOString(),
          durationMs: 820,
          statusCode: 504,
          error: 'Gateway Timeout (504)',
          backoffDelayMs: 1450,
        },
        {
          attemptNumber: 2,
          timestamp: new Date(now - 118000).toISOString(),
          durationMs: 910,
          statusCode: 504,
          error: 'Gateway Timeout (504)',
          backoffDelayMs: 4500,
        },
      ],
    };

    // 4. GitHub Push Webhook Delivered
    const ev4: RelayEvent = {
      id: 'evt_gh_push_11200b',
      idempotencyKey: 'idemp_gh_commit_88bf920',
      destinationUrl: 'https://api.yourdomain.com/webhooks/github',
      payload: {
        ref: 'refs/heads/main',
        repository: { name: 'RelayQueue', owner: 'shibildas' },
        commits: [{ id: '88bf920', message: 'feat: add full jitter backoff retry engine' }],
      },
      headers: {
        'x-relay-signature': 't=1729162000,v1=28d88e011fa99002c',
        'content-type': 'application/json',
      },
      signature: '28d88e011fa99002c',
      timestamp: now - 60000,
      status: 'DELIVERED',
      maxRetries: 3,
      currentAttempt: 1,
      nextRetryAt: null,
      createdAt: new Date(now - 60000).toISOString(),
      updatedAt: new Date(now - 59910).toISOString(),
      deliveredAt: new Date(now - 59910).toISOString(),
      latencyMs: 90,
      attempts: [
        {
          attemptNumber: 1,
          timestamp: new Date(now - 60000).toISOString(),
          durationMs: 90,
          statusCode: 200,
          responseBody: '{"ok":true,"buildQueued":true}',
        },
      ],
    };

    this.events.set(ev1.id, ev1);
    this.idempotencyMap.set(ev1.idempotencyKey, ev1.id);

    this.events.set(ev2.id, ev2);
    this.idempotencyMap.set(ev2.idempotencyKey, ev2.id);

    this.events.set(ev3.id, ev3);
    this.idempotencyMap.set(ev3.idempotencyKey, ev3.id);

    this.events.set(ev4.id, ev4);
    this.idempotencyMap.set(ev4.idempotencyKey, ev4.id);
  }
}

export const eventStore = new InMemoryEventStore();
