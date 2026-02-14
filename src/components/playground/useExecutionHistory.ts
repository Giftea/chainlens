"use client";

import { useState, useCallback } from "react";
import { HistoryEntry } from "./types";

const MAX_HISTORY = 10;

export function useExecutionHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
  }, []);

  const clearHistory = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, addEntry, clearHistory };
}
