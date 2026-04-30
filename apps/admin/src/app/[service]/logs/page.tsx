"use client";

import { useState, useEffect, useCallback, use } from "react";
import { EventList, type RunEvent } from "@/components/event-list";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";

export default function LogsPage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = use(params);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/events?service=${encodeURIComponent(service)}&limit=200`
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setEvents(data.events || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [live, fetchEvents]);

  return (
    <div>
      <BreadcrumbNav service={service} table="Logs" />
      <div className="flex items-center justify-between mt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={fetchEvents}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            data-testid="refresh-button"
          >
            Refresh
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
              className="rounded border-gray-300"
              data-testid="live-toggle"
            />
            Live (5s)
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading events...</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">
          {error}
        </div>
      ) : (
        <EventList
          events={events}
          showRunLink
          serviceName={service}
        />
      )}
    </div>
  );
}
