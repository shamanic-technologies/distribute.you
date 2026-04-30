"use client";

import { useState, useEffect, useRef, use } from "react";
import { EventList, type RunEvent } from "@/components/event-list";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import Link from "next/link";

export default function RunEventsPage({
  params,
}: {
  params: Promise<{ service: string; runId: string }>;
}) {
  const { service, runId } = use(params);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial fetch
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/runs/${runId}/events`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        const sorted = (data.events || []).sort(
          (a: RunEvent, b: RunEvent) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setEvents(sorted);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch events"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [runId]);

  // SSE streaming with auto-reconnect
  useEffect(() => {
    function connect() {
      setSseStatus("connecting");
      const es = new EventSource(`/api/runs/${runId}/events/stream`);
      eventSourceRef.current = es;

      es.onopen = () => setSseStatus("connected");

      es.onmessage = (msg) => {
        try {
          const evt: RunEvent = JSON.parse(msg.data);
          setEvents((prev) => {
            if (prev.some((e) => e.id === evt.id)) return prev;
            return [...prev, evt].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            );
          });
        } catch {
          // ignore non-JSON messages (heartbeats etc.)
        }
      };

      es.onerror = () => {
        setSseStatus("disconnected");
        es.close();
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [runId]);

  const sseColor = {
    connecting: "bg-amber-500",
    connected: "bg-green-500",
    disconnected: "bg-red-500",
  };

  const sseLabel = {
    connecting: "Connecting...",
    connected: "Live",
    disconnected: "Disconnected",
  };

  return (
    <div>
      <BreadcrumbNav service={service} table="Logs" />
      <div className="flex items-center gap-2 mt-4 mb-1">
        <Link
          href={`/${service}/logs`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Logs
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Run Events</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span
            className={`w-2 h-2 rounded-full ${sseColor[sseStatus]}`}
            data-testid="sse-indicator"
          />
          <span data-testid="sse-status">{sseLabel[sseStatus]}</span>
        </div>
      </div>

      <p className="text-xs font-mono text-gray-400 mb-4" data-testid="run-id">
        {runId}
      </p>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading events...</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">
          {error}
        </div>
      ) : (
        <EventList events={events} showService />
      )}
    </div>
  );
}
