import React, { useState } from 'react';
import { Copy, Check, Code2 } from 'lucide-react';

export function CodeSnippets() {
  const [lang, setLang] = useState<'curl' | 'typescript' | 'python' | 'go'>('typescript');
  const [copied, setCopied] = useState(false);

  const snippets = {
    curl: `curl -X POST https://relayqueue.vercel.app/api/v1/relay \\
  -H "Content-Type: application/json" \\
  -H "x-idempotency-key: idemp_order_998124" \\
  -d '{
    "destinationUrl": "https://api.yourdomain.com/webhooks/payment",
    "maxRetries": 3,
    "payload": {
      "transaction_id": "TX_998124",
      "amount": 49900,
      "currency": "INR",
      "status": "CAPTURED"
    }
  }'`,

    typescript: `import crypto from 'crypto';

interface RelayPayload {
  destinationUrl: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  maxRetries?: number;
}

export async function sendRelayedWebhook(params: RelayPayload) {
  const res = await fetch('https://relayqueue.vercel.app/api/v1/relay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-idempotency-key': params.idempotencyKey,
    },
    body: JSON.stringify({
      destinationUrl: params.destinationUrl,
      payload: params.payload,
      idempotencyKey: params.idempotencyKey,
      maxRetries: params.maxRetries ?? 3,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to dispatch webhook');
  }

  return data.event;
}`,

    python: `import requests
import uuid

def send_relayed_webhook(destination_url: str, payload: dict, idempotency_key: str = None):
    key = idempotency_key or f"idemp_{uuid.uuid4().hex[:12]}"
    
    response = requests.post(
        "https://relayqueue.vercel.app/api/v1/relay",
        headers={
            "Content-Type": "application/json",
            "x-idempotency-key": key,
        },
        json={
            "destinationUrl": destination_url,
            "payload": payload,
            "idempotencyKey": key,
            "maxRetries": 3,
        },
        timeout=10
    )
    
    response.raise_for_status()
    return response.json()["event"]`,

    go: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type RelayRequest struct {
	DestinationURL string                 \`json:"destinationUrl"\`
	Payload        map[string]interface{} \`json:"payload"\`
	IdempotencyKey string                 \`json:"idempotencyKey"\`
	MaxRetries     int                    \`json:"maxRetries"\`
}

func DispatchWebhook(destination string, payload map[string]interface{}, idempKey string) (*http.Response, error) {
	reqBody, _ := json.Marshal(RelayRequest{
		DestinationURL: destination,
		Payload:        payload,
		IdempotencyKey: idempKey,
		MaxRetries:     3,
	})

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequest("POST", "https://relayqueue.vercel.app/api/v1/relay", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-idempotency-key", idempKey)

	return client.Do(req)
}`,
  };

  const copyCode = () => {
    navigator.clipboard.writeText(snippets[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Code2 className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">Code Integration SDK</h3>
        </div>
        <div className="flex items-center space-x-1">
          {(['typescript', 'curl', 'python', 'go'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer capitalize ${
                lang === l
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {l === 'typescript' ? 'TypeScript' : l === 'curl' ? 'cURL' : l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 relative">
        <button
          onClick={copyCode}
          className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center space-x-1 text-xs cursor-pointer border border-slate-700/60"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        <pre className="p-4 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800 leading-relaxed max-h-72">
          {snippets[lang]}
        </pre>
      </div>
    </div>
  );
}
