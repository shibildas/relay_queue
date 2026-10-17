'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RelayEvent, QueueMetrics, EventStatus } from '@/types/queue';
import { Header } from '@/components/Header';
import { MetricsCards } from '@/components/MetricsCards';
import { EventList } from '@/components/EventList';
import { EventDetailModal } from '@/components/EventDetailModal';
import { WebhookStudio } from '@/components/WebhookStudio';
import { CodeSnippets } from '@/components/CodeSnippets';
import { ArchitectureView } from '@/components/ArchitectureView';
import { Zap, Code2, Layers } from 'lucide-react';

const DEFAULT_METRICS: QueueMetrics = {
  totalEvents: 0,
  delivered: 0,
  deadLetter: 0,
  retrying: 0,
  queued: 0,
  avgLatencyMs: 0,
  p50Ms: 0,
  p95Ms: 0,
  p99Ms: 0,
  successRate: 100,
};

export default function RelayQueueDashboard() {
  const [metrics, setMetrics] = useState<QueueMetrics>(DEFAULT_METRICS);
  const [events, setEvents] = useState<RelayEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<RelayEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'simulator' | 'sdk' | 'architecture'>('simulator');
  const [isRedis, setIsRedis] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);

  // Fetch metrics & events
  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, eventsRes] = await Promise.all([
        fetch('/api/v1/metrics'),
        fetch(`/api/v1/events?${statusFilter !== 'ALL' ? `status=${statusFilter}&` : ''}${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ''}`),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        if (data.metrics) setMetrics(data.metrics);
        if (data.engine?.isRedisConnected !== undefined) setIsRedis(data.engine.isRedisConnected);
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        if (data.events) setEvents(data.events);
      }
    } catch (err) {
      console.error('Failed to load RelayQueue data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Initial load & automatic polling every 2.5s for dynamic live-stream feel
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    const interval = setInterval(fetchData, 2500);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchData]);

  // Handle single DLQ replay
  const handleReplayEvent = async (eventId: string) => {
    setIsReplaying(true);
    try {
      const res = await fetch('/api/v1/dlq/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedEvent(data.event);
        fetchData();
      }
    } catch (err) {
      console.error('Replay error:', err);
    } finally {
      setIsReplaying(false);
    }
  };

  // Handle bulk DLQ replay
  const handleReplayAllDlq = async () => {
    setIsReplaying(true);
    try {
      const res = await fetch('/api/v1/dlq/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Bulk replay error:', err);
    } finally {
      setIsReplaying(false);
    }
  };

  // Reset Demo Data
  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      await fetch('/api/v1/dlq/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_demo' }),
      });
      await fetchData();
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header isRedis={isRedis} onResetDemo={handleResetDemo} isResetting={isResetting} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Metrics Strip */}
        <MetricsCards
          metrics={metrics}
          onReplayAllDlq={handleReplayAllDlq}
          isReplayingDlq={isReplaying}
        />

        {/* Master-Detail Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Event Stream & DLQ Inspector (5 cols) */}
          <div className="lg:col-span-5 h-full">
            <EventList
              events={events}
              selectedEventId={selectedEvent?.id || null}
              onSelectEvent={setSelectedEvent}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column: Webhook Studio, SDK, & Architecture (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* View Switcher Tabs */}
            <div className="flex space-x-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('simulator')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'simulator'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                <span>Interactive Simulator</span>
              </button>

              <button
                onClick={() => setActiveTab('sdk')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'sdk'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>Integration SDK</span>
              </button>

              <button
                onClick={() => setActiveTab('architecture')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'architecture'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-purple-400" />
                <span>Architecture &amp; Specs</span>
              </button>
            </div>

            {/* Active Workspace View */}
            {activeTab === 'simulator' && (
              <WebhookStudio onEventDispatched={fetchData} />
            )}

            {activeTab === 'sdk' && <CodeSnippets />}

            {activeTab === 'architecture' && <ArchitectureView />}
          </div>
        </div>
      </main>

      {/* Modal Inspector for Event Details */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onReplay={handleReplayEvent}
        isReplaying={isReplaying}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>
          RelayQueue &bull; Designed &amp; Engineered by{' '}
          <span className="text-slate-400 font-semibold">Shibil Das</span> &bull; Lead Software
          Engineer Portfolio
        </p>
      </footer>
    </div>
  );
}
