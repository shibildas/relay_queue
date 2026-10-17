import React from 'react';
import { QueueMetrics } from '@/types/queue';
import { ArrowUpRight, CheckCircle2, AlertOctagon, RefreshCw, Clock, Gauge } from 'lucide-react';

interface MetricsCardsProps {
  metrics: QueueMetrics;
  onReplayAllDlq: () => void;
  isReplayingDlq: boolean;
}

export function MetricsCards({ metrics, onReplayAllDlq, isReplayingDlq }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Total Ingested */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total Ingested</span>
          <ArrowUpRight className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">{metrics.totalEvents}</span>
          <span className="text-xs text-slate-500">events</span>
        </div>
        <div className="mt-2 text-[11px] text-cyan-400/90 font-medium flex items-center space-x-1">
          <span>Idempotency-locked</span>
        </div>
      </div>

      {/* 2. Success Rate */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Success Rate</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">{metrics.successRate}%</span>
          <span className="text-xs text-slate-500">({metrics.delivered} delivered)</span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400/90 font-medium">
          Zero data-loss guarantee
        </div>
      </div>

      {/* 3. Dead-Letter Queue (DLQ) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Dead-Letter Queue</span>
          <AlertOctagon className={`h-4 w-4 ${metrics.deadLetter > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span className={`text-2xl font-bold tracking-tight ${metrics.deadLetter > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {metrics.deadLetter}
            </span>
            <span className="text-xs text-slate-500">failed</span>
          </div>
          {metrics.deadLetter > 0 && (
            <button
              onClick={onReplayAllDlq}
              disabled={isReplayingDlq}
              className="text-[11px] font-semibold px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              title="Re-enqueue all DLQ events"
            >
              <RefreshCw className={`h-3 w-3 ${isReplayingDlq ? 'animate-spin' : ''}`} />
              <span>Replay All</span>
            </button>
          )}
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          Max retries exhausted
        </div>
      </div>

      {/* 4. Retrying / In-Flight */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Retrying (In-Flight)</span>
          <Clock className="h-4 w-4 text-indigo-400" />
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">{metrics.retrying}</span>
          <span className="text-xs text-slate-500">active</span>
        </div>
        <div className="mt-2 text-[11px] text-indigo-400 font-medium">
          Full jitter backoff active
        </div>
      </div>

      {/* 5. Latency Percentiles */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Latency Percentiles</span>
          <Gauge className="h-4 w-4 text-purple-400" />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">p50</span>
            <span className="font-bold text-white">{metrics.p50Ms}ms</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">p95</span>
            <span className="font-bold text-cyan-400">{metrics.p95Ms}ms</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">p99</span>
            <span className="font-bold text-purple-400">{metrics.p99Ms}ms</span>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          avg {metrics.avgLatencyMs}ms roundtrip
        </div>
      </div>
    </div>
  );
}
