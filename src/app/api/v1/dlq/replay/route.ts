import { NextRequest, NextResponse } from 'next/server';
import { WebhookDispatcher } from '@/lib/dispatcher';
import { eventStore } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const eventId: string | undefined = body.eventId;
    const replayAll: boolean = Boolean(body.all);

    if (replayAll) {
      const dlqEvents = await eventStore.listEvents({ status: 'DEAD_LETTER' });
      const replayed = [];
      for (const ev of dlqEvents) {
        try {
          const res = await WebhookDispatcher.replayDlqEvent(ev.id);
          replayed.push(res);
        } catch (e) {
          console.error(`Failed to replay ${ev.id}:`, e);
        }
      }
      return NextResponse.json({
        success: true,
        message: `Replayed ${replayed.length} Dead-Letter Queue events`,
        count: replayed.length,
        events: replayed,
      });
    }

    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing required field: eventId (or provide { all: true })' },
        { status: 400 }
      );
    }

    const replayed = await WebhookDispatcher.replayDlqEvent(eventId);
    return NextResponse.json({
      success: true,
      message: `Event ${eventId} successfully re-enqueued for dispatch`,
      event: replayed,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
