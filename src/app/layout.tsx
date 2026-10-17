import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RelayQueue | High-Throughput Event Relay & Webhook Gateway",
  description:
    "Zero-loss asynchronous event relay and webhook delivery gateway featuring HMAC-SHA256 verification, Redis-backed idempotency, exponential backoff retries with jitter, and dead-letter queue (DLQ) replay.",
  keywords: [
    "Webhook Gateway",
    "Event Relay",
    "Dead Letter Queue",
    "Idempotency",
    "HMAC SHA256",
    "Distributed Systems",
    "Next.js",
  ],
  authors: [{ name: "Shibil Das" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
