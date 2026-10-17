import React from 'react';
import { Layers, ShieldAlert, Cpu, GitCommit } from 'lucide-react';
import { getRetrySchedulePreview } from '@/lib/backoff';

export function ArchitectureView() {
  const schedule = getRetrySchedulePreview(5);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm space-y-6">
      {/* Title */}
      <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
        <Layers className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-bold text-white tracking-tight">
          System Architecture &amp; Lead Engineering Specs
        </h3>
      </div>

      {/* Pipeline Diagram */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-3">
          Event Pipeline Lifecycle
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-cyan-400 font-bold block">1. Ingest &amp; Verify</span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              HMAC-SHA256 timing-safe check + Idempotency hash lookup
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-indigo-400 font-bold block">2. Dispatch Worker</span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              AbortController timeout + Header forward + Latency benchmark
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-purple-400 font-bold block">3. Jitter Retry</span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Exponential backoff with Full Jitter to avoid thundering herds
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-rose-400 font-bold block">4. DLQ Escalation</span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Dead-letter queue isolation + 1-click safe replay with audit trace
            </span>
          </div>
        </div>
      </div>

      {/* Backoff Jitter Math Table */}
      <div>
        <div className="flex items-center space-x-2 mb-2">
          <Cpu className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-bold text-white">Full Jitter Backoff Schedule</h4>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">
          Formula: <code className="text-indigo-300 font-mono">Sleep = rand(0.5 * Base, min(Cap, Base * 2^(attempt-1)))</code>
        </p>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold">
              <tr>
                <th className="p-2.5">Attempt</th>
                <th className="p-2.5">Theoretical Base</th>
                <th className="p-2.5">Jitter Delay Range</th>
                <th className="p-2.5">Target Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              {schedule.map((row) => (
                <tr key={row.attempt} className="hover:bg-slate-800/30">
                  <td className="p-2.5 text-white font-bold">Attempt #{row.attempt}</td>
                  <td className="p-2.5 text-slate-400">{row.theoreticalDelayMs}ms</td>
                  <td className="p-2.5 text-cyan-300">{row.minDelayMs}ms - {row.maxDelayMs}ms</td>
                  <td className="p-2.5">
                    {row.attempt < 5 ? (
                      <span className="text-indigo-400">RETRYING</span>
                    ) : (
                      <span className="text-rose-400 font-bold">DEAD_LETTER</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distributed System Trade-offs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
            <GitCommit className="h-4 w-4" />
            <span>At-Least-Once Delivery Semantics</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            In distributed systems, true &quot;exactly-once&quot; over unreliable networks is mathematically impossible without two-phase commit protocols that cripple throughput. RelayQueue guarantees strict <strong>at-least-once delivery</strong> coupled with mandatory consumer idempotency keys.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
            <ShieldAlert className="h-4 w-4" />
            <span>Thundering Herd &amp; Cache Stampede</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Fixed exponential retries cause all failing clients to retry in lockstep waves, repeatedly crashing recovering backends. RelayQueue&apos;s randomized Full Jitter spreads retry pressure evenly across the timeline.
          </p>
        </div>
      </div>
    </div>
  );
}
