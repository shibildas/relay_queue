import { NextRequest, NextResponse } from 'next/server';
import { eventStore } from '@/lib/storage';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await eventStore.getEvent(id);

    if (!event) {
      return NextResponse.json({ error: `Event '${id}' not found` }, { status: 404 });
    }

    return NextResponse.json({ success: true, event });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
