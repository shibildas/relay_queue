import { NextRequest, NextResponse } from 'next/server';
import { eventStore } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'reset_demo';

    if (action === 'clear_all') {
      await eventStore.clearAll();
      return NextResponse.json({
        success: true,
        message: 'All queue events and idempotency keys cleared.',
      });
    }

    // Default: seed demo data
    await eventStore.seedDemoData();
    return NextResponse.json({
      success: true,
      message: 'Demo queue events and telemetry re-seeded successfully.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
