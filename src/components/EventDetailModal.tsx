import React, { useState } from 'react';
import { RelayEvent } from '@/types/queue';
import { X, Copy, Check, RefreshCw, ShieldCheck, Terminal, AlertTriangle } from 'lucide-react';

interface EventDetailModalProps {
  event: RelayEvent | null;
  onClose: () => void;
  onReplay: (eventId: string) => void;
  isReplaying: boolean;
}

export function EventDetailModal({ event, onClose, onReplay, isReplaying }: EventDetailModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!event) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const payloadString =
    typeof event.payload === 'string'
      ? event.payload
      : JSON.stringify(event.payload, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-bold text-white">{event.id}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  event.status === 'DELIVERED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : event.status === 'DEAD_LETTER'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                }`}
              >
                {event.status}
              </span>
              {event.isReplay && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  REPLAY
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">{event.destinationUrl}</p>
          </div>

          <div className="flex items-center space-x-2">
            {event.status === 'DEAD_LETTER' && (
              <button
                onClick={() => onReplay(event.id)}
                disabled={isReplaying}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isReplaying ? 'animate-spin' : ''}`} />
                <span>1-Click Replay</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* DLQ Alert if dead lettered */}
          {event.deadLetterReason && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-rose-300 block">Dead-Letter Queue Escalation</span>
                <span className="text-slate-300 mt-0.5 block">{event.deadLetterReason}</span>
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Idempotency Key */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider">Idempotency Key</span>
                <button
                  onClick={() => copyToClipboard(event.idempotencyKey, 'idemp')}
                  className="hover:text-white transition"
                >
                  {copiedKey === 'idemp' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <span className="font-mono text-slate-200 break-all select-all">{event.idempotencyKey}</span>
            </div>

            {/* HMAC Signature */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1">
                  <ShieldCheck className="h-3 w-3 text-cyan-400" />
                  <span>HMAC-SHA256 Signature</span>
                </span>
                <button
                  onClick={() => copyToClipboard(event.signature, 'sig')}
                  className="hover:text-white transition"
                >
                  {copiedKey === 'sig' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <span className="font-mono text-slate-200 break-all select-all">{event.signature}</span>
            </div>
          </div>

          {/* Delivery Attempts Trace */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
              Delivery Attempts Audit Log ({event.attempts.length} attempts)
            </span>
            <div className="space-y-2.5">
              {event.attempts.map((attempt) => (
                <div
                  key={attempt.attemptNumber}
                  className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">Attempt #{attempt.attemptNumber}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          attempt.statusCode && attempt.statusCode >= 200 && attempt.statusCode < 300
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        HTTP {attempt.statusCode || 'ERR'}
                      </span>
                      <span className="text-slate-500 text-[11px]">{attempt.durationMs}ms</span>
                    </div>
                    {attempt.error && (
                      <p className="text-rose-300 text-[11px] font-mono">{attempt.error}</p>
                    )}
                    {attempt.responseBody && (
                      <p className="text-slate-400 text-[11px] font-mono truncate max-w-lg">
                        Resp: {attempt.responseBody}
                      </p>
                    )}
                  </div>

                  {attempt.backoffDelayMs && (
                    <div className="text-right text-[11px] text-indigo-400 shrink-0">
                      <span className="block font-medium">Jitter backoff:</span>
                      <span className="font-bold">+{attempt.backoffDelayMs}ms</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payload Inspector */}
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5">
                <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                <span>Event Ingestion Payload</span>
              </span>
              <button
                onClick={() => copyToClipboard(payloadString, 'payload')}
                className="flex items-center space-x-1 text-slate-400 hover:text-white transition cursor-pointer"
              >
                {copiedKey === 'payload' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>Copy JSON</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800/80 leading-relaxed max-h-56">
              {payloadString}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
          <span>Created: {new Date(event.createdAt).toLocaleString()}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
