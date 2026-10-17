# ⚡ RelayQueue

> **High-Throughput Asynchronous Event Relay & Webhook Gateway**  
> *Engineered for zero data-loss delivery, HMAC-SHA256 cryptographic verification, Redis-backed idempotency, exponential backoff with full jitter, and Dead-Letter Queue (DLQ) replay.*

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/shibildas/RelayQueue)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15%20App%20Router-black.svg)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Executive Summary & Architectural Motivation

In high-volume distributed systems (such as payment processing with **₹1-3 Cr/month** transaction volumes via HDFC SmartGateway or Stripe), external webhooks and asynchronous event deliveries are notoriously fragile. Downstream microservices crash, network routes timeout, and upstream webhooks fire duplicate payloads or out-of-order retries.

**RelayQueue** solves this fundamental reliability gap. It acts as an enterprise-grade shock absorber and delivery gateway positioned between webhook producers and receiving consumer services:

1. **Deterministic Idempotency**: Intercepts duplicate events at the gateway boundary using SHA-256 payload digest fingerprinting and distributed key locking.
2. **Timing-Safe Cryptographic Verification**: Validates HMAC-SHA256 signatures with millisecond timestamp freshness windows to eliminate side-channel timing analysis and replay attacks.
3. **Thundering Herd Mitigation**: Implements exponential backoff with **Full Jitter** ($Sleep = \text{rand}(0.5 \times \text{Base}, \min(\text{Cap}, \text{Base} \times 2^{\text{attempt}-1}))$), preventing lockstep retry storms that crash recovering backends.
4. **Dead-Letter Queue (DLQ) & 1-Click Replay**: Safely isolates exhausted retries with complete audit logs (HTTP statuses, response bodies, latency timestamps) and provides atomic 1-click re-injection.
5. **Real-Time Developer Cockpit**: Live observability dashboard displaying throughput, SLA compliance, p50/p95/p99 latency percentiles, and an interactive webhook test studio.

---

## 🏗️ System Architecture & Event Pipeline

```
                                      [ Incoming Webhook / Event ]
                                                   │
                                                   ▼
                                       ┌───────────────────────┐
                                       │   POST /api/v1/relay  │
                                       └───────────┬───────────┘
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                         ▼                                                   ▼
            [ 1. HMAC Verification ]                                [ 2. Idempotency Check ]
      • Timing-safe buffer comparison                         • x-idempotency-key or SHA-256
      • ±300s timestamp tolerance                             • Cache hit -> return 200 cached
                         │                                                   │
                         └─────────────────────────┬─────────────────────────┘
                                                   │ (Pass)
                                                   ▼
                                       ┌───────────────────────┐
                                       │ Enqueue & Dispatcher  │
                                       │   (AbortController)   │
                                       └───────────┬───────────┘
                                                   │
                                     ┌─────────────┴─────────────┐
                         (2xx Success)                           (4xx / 5xx / Timeout)
                                     ▼                                           ▼
                            [ State: DELIVERED ]                        [ State: RETRYING ]
                         • Record roundtrip latency              • Calculate Full Jitter Backoff
                         • Deliver payload to consumer           • Wait schedule: Attempt n of N
                                                                                 │
                                                                                 ▼
                                                                 (Attempts Exhausted: Max reached)
                                                                                 │
                                                                                 ▼
                                                                      [ State: DEAD_LETTER ]
                                                                 • Quarantine in DLQ
                                                                 • Detailed Failure Reason Log
                                                                 • Ready for 1-Click Replay
```

---

## ⚡ Key Technical Innovations

### 1. Timing-Safe Cryptographic Signature Engine
Prevents side-channel timing attacks by executing constant-time comparisons with `crypto.timingSafeEqual`:
```typescript
const bufferA = Buffer.from(signatureHex, 'hex');
const bufferB = Buffer.from(expectedDigest, 'hex');
if (bufferA.length !== bufferB.length) return { valid: false };
const match = crypto.timingSafeEqual(bufferA, bufferB);
```

### 2. Exponential Backoff with Full Jitter
Rather than naive exponential retry waves ($2^n$) which create cyclic stampedes, RelayQueue uses randomized full jitter:
```typescript
const calculatedDelay = baseDelayMs * Math.pow(2, attempt - 1);
const cappedDelay = Math.min(maxDelayMs, calculatedDelay);
const minJitter = Math.min(baseDelayMs / 2, cappedDelay / 2);
const delay = minJitter + Math.random() * (cappedDelay - minJitter);
```

| Attempt | Base Delay | Jitter Backoff Range | Action |
|:---|:---|:---|:---|
| Attempt #1 | 1,000ms | 500ms - 1,000ms | Initial retry on transient fault |
| Attempt #2 | 2,000ms | 500ms - 2,000ms | Spreads retry pressure across workers |
| Attempt #3 | 4,000ms | 500ms - 4,000ms | Backoff escalation |
| Attempt #4 | 8,000ms | 500ms - 8,000ms | Final recovery window |
| Attempt #5 | 16,000ms | - | **Escalated to Dead-Letter Queue (DLQ)** |

### 3. Pluggable Storage & Zero-Config Fallback
- **Development & Preview**: High-speed in-memory singleton store with demo telemetry, requiring zero environment variables to test immediately.
- **Production Edge**: Seamlessly switches to distributed **Upstash Redis** when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present.

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install
```bash
git clone https://github.com/shibildas/RelayQueue.git
cd RelayQueue
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to explore the **Developer Cockpit**.

### 3. Run Production Build
```bash
npm run build
npm run start
```

---

## 📡 REST API Reference

### 1. Ingest Event
```http
POST /api/v1/relay
Content-Type: application/json
x-idempotency-key: idemp_order_12345
```
**Request Body:**
```json
{
  "destinationUrl": "https://api.yourdomain.com/webhooks/payment",
  "maxRetries": 3,
  "payload": {
    "transaction_id": "TX_998124",
    "amount": 49900,
    "currency": "INR",
    "status": "CAPTURED"
  }
}
```

### 2. List Events & Filter
```http
GET /api/v1/events?status=DEAD_LETTER&limit=25
```

### 3. Replay DLQ Event
```http
POST /api/v1/dlq/replay
Content-Type: application/json

{
  "eventId": "evt_dlq_hdfc_441c8e"
}
```
*Pass `{ "all": true }` to replay all dead-lettered events in bulk.*

### 4. Fetch System Telemetry & Latencies
```http
GET /api/v1/metrics
```
**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalEvents": 48,
    "delivered": 46,
    "deadLetter": 1,
    "retrying": 1,
    "avgLatencyMs": 142,
    "p50Ms": 95,
    "p95Ms": 310,
    "p99Ms": 512,
    "successRate": 97.8
  }
}
```

---

## 🧪 Interactive Webhook Studio Scenarios

The Developer Cockpit includes built-in test targets:
- `mock://destination-flaky-auto-recover`: Intentionally fails attempt 1 & 2 with HTTP 500, then succeeds on attempt 3. Demonstrates jittered recovery live.
- `mock://destination-200-ok`: Simulates sub-100ms successful delivery.
- `mock://destination-error-500`: Simulates database pool exhaustion; retries up to maximum budget and escalates to DLQ.
- `mock://destination-timeout-504`: Simulates network timeouts via `AbortController`.

---

## 🌐 Deploy to Vercel

1. Push your repository to GitHub.
2. Import the project in the [Vercel Dashboard](https://vercel.com/new).
3. (Optional) In project settings, add Upstash Redis credentials for persistent distributed storage:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `RELAY_WEBHOOK_SECRET`
4. Click **Deploy**. The application is 100% serverless and edge-ready out of the box!

---

## 👨‍💻 Author

**Shibil Das**  
*Lead Software Engineer*  
- GitHub: [@shibildas](https://github.com/shibildas)
- Core Focus: High-Throughput Event Systems, Distributed Message Queues (RabbitMQ/Kafka), Resilient Payment Infrastructure, Microservices Architecture.

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
