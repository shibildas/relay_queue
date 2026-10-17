import React, { useState } from 'react';
import { Send, Zap, Shuffle, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { IngestEventResponse } from '@/types/queue';

interface WebhookStudioProps {
  onEventDispatched: () => void;
}

const PAYLOAD_PRESETS = {
  stripe: {
    event: 'payment_intent.succeeded',
    data: {
      id: 'pi_3Mo4Lq2eZvKYlo2C0eGz',
      amount: 49900,
      currency: 'inr',
      customer: 'cus_PackapeerDev_99',
      status: 'succeeded',
    },
  },
  razorpay: {
    event: 'order.paid',
    payload: {
      payment: {
        id: 'pay_HDFC_SmartGateway_8819',
        order_id: 'order_EK92L0019A',
        amount: 125000,
        currency: 'INR',
        method: 'upi',
      },
    },
  },
  github: {
    event: 'push',
    ref: 'refs/heads/main',
    repository: 'shibildas/RelayQueue',
    head_commit: {
      id: 'fa89012c',
      message: 'feat(queue): implement jittered exponential backoff and DLQ replay',
      author: 'Shibil Das <shibil@relayqueue.io>',
    },
  },
  custom: {
    event: 'custom.event',
    timestamp: Date.now(),
    message: 'Hello from RelayQueue Developer Cockpit',
  },
};

export function WebhookStudio({ onEventDispatched }: WebhookStudioProps) {
  const [scenario, setScenario] = useState<'200' | '500' | '504' | 'flaky' | 'custom'>('flaky');
  const [customUrl, setCustomUrl] = useState('https://httpbin.org/post');
  const [preset, setPreset] = useState<keyof typeof PAYLOAD_PRESETS>('stripe');
  const [payloadText, setPayloadText] = useState(JSON.stringify(PAYLOAD_PRESETS.stripe, null, 2));
  const [idempotencyKey, setIdempotencyKey] = useState('idemp_order_live_9021');
  const [maxRetries, setMaxRetries] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<IngestEventResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePresetChange = (key: keyof typeof PAYLOAD_PRESETS) => {
    setPreset(key);
    setPayloadText(JSON.stringify(PAYLOAD_PRESETS[key], null, 2));
  };

  const generateNewIdempotencyKey = () => {
    setIdempotencyKey(`idemp_${Math.random().toString(36).substring(2, 10)}`);
  };

  const getDestinationUrl = () => {
    switch (scenario) {
      case '200':
        return 'mock://destination-200-ok';
      case '500':
        return 'mock://destination-error-500';
      case '504':
        return 'mock://destination-timeout-504';
      case 'flaky':
        return 'mock://destination-flaky-auto-recover';
      case 'custom':
        return customUrl;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    setErrorMsg(null);

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payloadText);
    } catch {
      setErrorMsg('Invalid JSON format in payload');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/relay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          destinationUrl: getDestinationUrl(),
          payload: parsedPayload,
          idempotencyKey,
          maxRetries,
        }),
      });

      const data: IngestEventResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to dispatch event');
      }

      setResult(data);
      onEventDispatched();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown dispatch error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Zap className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">Interactive Webhook Studio</h3>
        </div>
        <span className="text-[11px] text-slate-400">Live Simulator</span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Scenario Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Destination Target Scenario
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'flaky', label: 'Flaky 50/50', desc: 'Fails 2x, recovers 3rd' },
              { id: '200', label: '200 OK', desc: 'Instant 200 delivery' },
              { id: '500', label: '500 Error', desc: 'Retries & enters DLQ' },
              { id: '504', label: '504 Timeout', desc: 'Simulated network lag' },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setScenario(item.id as typeof scenario)}
                className={`p-2 rounded-lg text-left border transition cursor-pointer ${
                  scenario === item.id
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold">{item.label}</div>
                <div className="text-[10px] text-slate-500">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {scenario === 'custom' && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Custom Target Webhook URL
            </label>
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Idempotency Key & Retries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
                <span>Idempotency-Key</span>
              </label>
              <button
                type="button"
                onClick={generateNewIdempotencyKey}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer"
              >
                <Shuffle className="h-3 w-3" />
                <span>New Key</span>
              </button>
            </div>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Re-sending with same key tests duplicate rejection.
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Max Retries Budget: <span className="text-white font-bold">{maxRetries}</span>
              </label>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={maxRetries}
              onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>1 attempt</span>
              <span>3 recommended</span>
              <span>5 max</span>
            </div>
          </div>
        </div>

        {/* Presets & Payload Editor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300">Payload Template</label>
            <div className="flex space-x-1">
              {(['stripe', 'razorpay', 'github', 'custom'] as const).map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => handlePresetChange(key)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider cursor-pointer ${
                    preset === key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={5}
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            className="w-full bg-slate-950 font-mono text-xs text-slate-300 p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 leading-relaxed"
          />
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Relaying &amp; Dispatching...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Dispatch Webhook Event</span>
            </>
          )}
        </button>

        {/* Feedback / Result notification */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {result && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${
              result.isDuplicate
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            }`}
          >
            {result.isDuplicate ? (
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-bold block">
                {result.isDuplicate ? 'Deduplication Intercepted!' : 'Dispatched Successfully!'}
              </span>
              <span className="text-[11px] opacity-90 block mt-0.5">
                {result.message} (Event: {result.event.id}, Status: {result.event.status})
              </span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
