import { useState, useCallback } from "react";

export interface ScanHistoryEntry {
  id: string;
  componentName: string;
  score: number;
  atomicLevel: string | null;
  issueCount: number;
  scannedAt: string;
}

const STORAGE_KEY = "designready-scan-history";
const MAX_ENTRIES = 20;

function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: ScanHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* quota exceeded — silently drop */ }
}

export function useScanHistory() {
  const [history, setHistory] = useState<ScanHistoryEntry[]>(loadHistory);

  const addEntry = useCallback((entry: Omit<ScanHistoryEntry, "id" | "scannedAt">) => {
    setHistory(prev => {
      const newEntry: ScanHistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        scannedAt: new Date().toISOString(),
      };
      const next = [newEntry, ...prev].slice(0, MAX_ENTRIES);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addEntry, clearHistory };
}
