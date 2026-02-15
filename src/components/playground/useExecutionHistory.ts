"use client";

import { useState, useCallback, useEffect } from "react";
import { HistoryEntry } from "./types";

const MAX_HISTORY = 10;
const STORAGE_KEY = "chainlens-playground-history";

function loadFromStorage(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable
  }
}

export function useExecutionHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setEntries(loadFromStorage());
  }, []);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      saveToStorage(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setEntries([]);
    saveToStorage([]);
  }, []);

  return { entries, addEntry, clearHistory };
}
