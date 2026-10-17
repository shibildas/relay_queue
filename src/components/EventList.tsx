import React from 'react';
import { RelayEvent, EventStatus } from '@/types/queue';
import { Search, CheckCircle, AlertTriangle, Clock, ChevronRight, RotateCcw } from 'lucide-react';

interface EventListProps {
  events: RelayEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: RelayEvent) => void;
  statusFilter: EventStatus | 'ALL';
  onStatusFilterChange: (status: EventStatus | 'ALL') => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  isLoading: boolean;
}

export function EventList({
  events,
  selectedEventId,
  onSelectEvent,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  isLoading,
}: EventListProps) {
  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="h-3 w-3" />
            <span>Delivered</span>
          </span>
        );
      case 'DEAD_LETTER':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="h-3 w-3" />
            <span>Dead Letter (DLQ)</span>
          </span>
        );
      case 'RETRYING':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
            <Clock className="h-3 w-3" />
            <span>Retrying</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <RotateCcw className="h-3 w-3 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'QUEUED':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <span>Queued</span>
          </span>
        );
    }
  };

  const tabs: Array<{ id: EventStatus | 'ALL'; label: string }> = [
    { id: 'ALL', label: 'All' },
    { id: 'DELIVERED', label: 'Delivered' },
    { id: 'RETRYING', label: 'Retrying' },
    { id: 'DEAD_LETTER', label: 'DLQ' },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full backdrop-blur-sm">
      {/* Search & Tabs Header */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by event ID, idempotency key, or URL..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onStatusFilterChange(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 min-h-[420px] max-h-[640px]">
        {isLoading && events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading queue events...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No events match the selected criteria.
          </div>
        ) : (
          events.map((event) => {
            const isSelected = selectedEventId === event.id;
            return (
              <div
                key={event.id}
                onClick={() => onSelectEvent(event)}
                className={`p-3.5 hover:bg-slate-800/50 transition cursor-pointer border-l-2 ${
                  isSelected
                    ? 'bg-slate-800/80 border-indigo-500'
                    : 'border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-semibold text-slate-200">
                      {event.id}
                    </span>
                    {event.isReplay && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                        REPLAY
                      </span>
                    )}
                  </div>
                  {getStatusBadge(event.status)}
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[200px] sm:max-w-[260px] text-slate-300 font-mono">
                    {event.destinationUrl}
                  </span>
                  <span>
                    {event.latencyMs !== undefined ? `${event.latencyMs}ms` : `Att ${event.currentAttempt}/${event.maxRetries}`}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                  <div className="flex items-center space-x-1 text-slate-400 hover:text-indigo-400">
                    <span>Inspect</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
