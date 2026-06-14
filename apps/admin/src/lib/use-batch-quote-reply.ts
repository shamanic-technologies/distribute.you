"use client";

import { useCallback, useRef, useState } from "react";
import {
  runBatchReplies,
  type BatchCallbacks,
  type BatchRowState,
  type BatchSummary,
} from "./batch-quote-reply";

export interface UseBatchQuoteReply<T> {
  /** Kick off the sequential batch over `eligible`. No-op if already running or
   *  the list is empty. Resolves to the final summary (or null on no-op). */
  run: (eligible: T[]) => Promise<BatchSummary | null>;
  isRunning: boolean;
  /** Per-opportunity-id row state, updated live during the run. */
  rowStates: Map<string, BatchRowState>;
  /** 0-based index of the opp currently processing. */
  index: number;
  /** Eligible count the current/last run started with. */
  total: number;
  /** Final summary, set when a run finishes; null while running / before run. */
  summary: BatchSummary | null;
}

/**
 * React wrapper around the framework-agnostic `runBatchReplies` loop. The loop
 * itself runs in the browser (each generate + each reply is its own fetch);
 * this hook only mirrors its progress into render state. Callbacks are supplied
 * per surface (authed HITL uses the api.ts functions; the public report uses
 * its Route Handler fetches), so the same loop drives both.
 */
export function useBatchQuoteReply<T>(
  cb: BatchCallbacks<T>,
): UseBatchQuoteReply<T> {
  const [isRunning, setIsRunning] = useState(false);
  const [rowStates, setRowStates] = useState<Map<string, BatchRowState>>(
    () => new Map(),
  );
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(
    async (eligible: T[]): Promise<BatchSummary | null> => {
      if (runningRef.current || eligible.length === 0) return null;
      runningRef.current = true;

      const live = new Map<string, BatchRowState>(
        eligible.map((o) => [cb.idOf(o), "pending" as BatchRowState]),
      );
      setRowStates(new Map(live));
      setTotal(eligible.length);
      setIndex(0);
      setSummary(null);
      setIsRunning(true);

      const result = await runBatchReplies(eligible, cb, {
        onRow: (id, state) => {
          live.set(id, state);
          setRowStates(new Map(live));
        },
        onIndex: (i) => setIndex(i),
      });

      setSummary(result);
      setIsRunning(false);
      runningRef.current = false;
      return result;
    },
    [cb],
  );

  return { run, isRunning, rowStates, index, total, summary };
}
