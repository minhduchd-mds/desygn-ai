import { useState, useCallback, useEffect, useRef } from "react";
import type { SerializedNode, BatchScanResult, PluginProfile } from "../../shared/types";
import { batchScan } from "../lib/batch-scanner";

export function useBatchScan() {
  const [result, setResult] = useState<BatchScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileRef = useRef<PluginProfile | null>(null);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (!msg || msg.type !== "batch-selection-result") return;

      if (batchTimeoutRef.current) { clearTimeout(batchTimeoutRef.current); batchTimeoutRef.current = null; }

      const nodes = msg.nodes as SerializedNode[];
      if (nodes.length === 0) {
        setError("No components selected");
        setIsScanning(false);
        return;
      }

      try {
        const data = batchScan(nodes, profileRef.current);
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Batch scan failed");
      } finally {
        setIsScanning(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const scan = useCallback((profile?: PluginProfile | null) => {
    setIsScanning(true);
    setError(null);
    setResult(null);
    profileRef.current = profile ?? null;
    parent.postMessage({ pluginMessage: { type: "request-batch-selection" } }, "*");

    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    batchTimeoutRef.current = setTimeout(() => {
      setError("Batch scan timed out. Please try again.");
      setIsScanning(false);
      batchTimeoutRef.current = null;
    }, 10000);
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isScanning, error, scan, reset };
}
