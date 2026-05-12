import { useState, useCallback, useEffect, useRef } from "react";
import type { SerializedNode, ScanResult, ViewportVariant, PluginProfile } from "../../shared/types";
import { scan as runScan } from "../lib/scanner";

export function useScan() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<ViewportVariant[]>([]);
  const pendingNodeRef = useRef<SerializedNode | null>(null);
  const profileRef = useRef<PluginProfile | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === "variants-result") {
        if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
        setVariants(msg.variants);
        if (pendingNodeRef.current) {
          executeScan(pendingNodeRef.current, msg.variants);
          pendingNodeRef.current = null;
        }
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const executeScan = (node: SerializedNode, detectedVariants: ViewportVariant[]) => {
    try {
      const data = runScan(node, detectedVariants.length > 1 ? detectedVariants : undefined, profileRef.current);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  const scan = useCallback((node: SerializedNode, profile?: PluginProfile | null) => {
    setIsScanning(true);
    setError(null);
    pendingNodeRef.current = node;
    profileRef.current = profile ?? null;
    parent.postMessage({ pluginMessage: { type: "request-variants" } }, "*");

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      if (pendingNodeRef.current) {
        pendingNodeRef.current = null;
        setError("Scan timed out. Please try again.");
        setIsScanning(false);
      }
    }, 10000);
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setVariants([]);
  }, []);

  return { result, isScanning, error, scan, reset, variants };
}
