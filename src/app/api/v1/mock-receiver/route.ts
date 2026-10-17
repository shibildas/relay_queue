import { NextRequest, NextResponse } from 'next/server';
import { verifyHmacSignature, DEFAULT_WEBHOOK_SECRET } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scenario = searchParams.get('scenario') || '200';
    const verifyHeader = req.headers.get('x-relay-signature');
    const secret = req.headers.get('x-relay-secret') || DEFAULT_WEBHOOK_SECRET;

    const rawBody = await req.text();
    let parsedBody: Record<string, unknown> = {};
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = { raw: rawBody };
    }

    // Check signature if header provided
    let signatureVerified = false;
    let signatureReason: string | undefined;

    if (verifyHeader) {
      const verifyResult = verifyHmacSignature(rawBody, verifyHeader, secret, 3600);
      signatureVerified = verifyResult.valid;
      signatureReason = verifyResult.reason;
    }

    // 1. Force 500
    if (scenario === '500') {
      return NextResponse.json(
        {
          error: 'Simulated 500 Internal Server Error',
          code: 'DATABASE_LOCKED',
          signatureVerified,
        },
        { status: 500 }
      );
    }

    // 2. Force 504
    if (scenario === '504') {
      // Simulate slow response before error
      await new Promise((resolve) => setTimeout(resolve, 800));
      return NextResponse.json(
        {
          error: 'Simulated 504 Gateway Timeout',
          signatureVerified,
        },
        { status: 504 }
      );
    }

    // 3. Force 401 Unauthorized
    if (scenario === '401' || (!signatureVerified && verifyHeader)) {
      return NextResponse.json(
        {
          error: 'Invalid or missing cryptographic signature',
          reason: signatureReason || 'HMAC verification failed',
        },
        { status: 401 }
      );
    }

    // Default: 200 OK
    return NextResponse.json({
      status: 'success',
      message: 'Webhook received and acknowledged',
      receivedAt: new Date().toISOString(),
      payloadSummary: {
        keys: Object.keys(parsedBody),
        byteLength: rawBody.length,
      },
      signatureVerified,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    description: 'RelayQueue Mock Webhook Receiver. Accepts POST with optional ?scenario=200|500|504|flaky',
  });
}
