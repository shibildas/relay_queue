import { NextRequest, NextResponse } from 'next/server';
import { eventStore } from '@/lib/storage';
import { EventStatus } from '@/types/queue';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as EventStatus | null;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const search = searchParams.get('q') || undefined;

    const events = await eventStore.listEvents({
      status: status || undefined,
      limit,
      search,
    });

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
