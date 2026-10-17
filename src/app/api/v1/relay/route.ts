import { NextRequest, NextResponse } from 'next/server';
import { RelayEvent } from '@/types/queue';
import { generateHmacSignature, computePayloadDigest, DEFAULT_WEBHOOK_SECRET } from '@/lib/crypto';
import { eventStore } from '@/lib/storage';
import { WebhookDispatcher } from '@/lib/dispatcher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.destinationUrl) {
      return NextResponse.json(
        { error: 'Missing required field: destinationUrl' },
        { status: 400 }
      );
    }

    const destinationUrl: string = body.destinationUrl;
    const payload = body.payload ?? {};
    const maxRetries: number = typeof body.maxRetries === 'number' ? Math.min(Math.max(body.maxRetries, 1), 10) : 3;
    const secret: string = body.secret || DEFAULT_WEBHOOK_SECRET;
    const customHeaders: Record<string, string> = body.headers || {};

    // 1. Idempotency Check
    // If client supplied Idempotency-Key header or body field, use it. Otherwise hash payload.
    const headerIdempKey = req.headers.get('x-idempotency-key') || req.headers.get('idempotency-key');
    const idempotencyKey =
      body.idempotencyKey || headerIdempKey || `idemp_${computePayloadDigest(payload).slice(0, 24)}`;

    const existingEvent = await eventStore.getEventByIdempotencyKey(idempotencyKey);
    if (existingEvent) {
      return NextResponse.json(
        {
          success: true,
          isDuplicate: true,
          message: 'Idempotent request recognized. Returning existing event record.',
          event: existingEvent,
        },
        { status: 200 }
      );
    }

    // 2. Cryptographic Signing
    const now = Date.now();
    const { signature, headerValue } = generateHmacSignature(payload, secret, now);

    // 3. Assemble Relay Event
    const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const newEvent: RelayEvent = {
      id: eventId,
      idempotencyKey,
      destinationUrl,
      payload,
      headers: {
        'Content-Type': 'application/json',
        'x-relay-signature': headerValue,
        'x-relay-timestamp': String(now),
        ...customHeaders,
      },
      signature,
      timestamp: now,
      status: 'QUEUED',
      maxRetries,
      currentAttempt: 0,
      nextRetryAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: [],
    };

    // 4. Save to Storage / Redis
    await eventStore.saveEvent(newEvent);

    // 5. Trigger Immediate Dispatch Attempt
    const dispatchedEvent = await WebhookDispatcher.dispatch(newEvent, {
      timeoutMs: 6000,
      autoProcessRetries: true,
    });

    return NextResponse.json(
      {
        success: true,
        isDuplicate: false,
        message: 'Event enqueued and processed successfully.',
        event: dispatchedEvent,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Relay error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
