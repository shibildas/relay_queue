import { NextResponse } from 'next/server';
import { eventStore } from '@/lib/storage';

export async function GET() {
  try {
    const metrics = await eventStore.getMetrics();
    const isRedis = eventStore.isRedisConnected();

    return NextResponse.json({
      success: true,
      metrics,
      engine: {
        storageType: isRedis ? 'Upstash Redis Cluster' : 'In-Memory Singleton Store',
        isRedisConnected: isRedis,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
