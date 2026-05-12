import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignSystemSnapshot } from "../../shared/types";

interface SnapshotState {
  snapshot: DesignSystemSnapshot | null;
  isLoading: boolean;
  error: string | null;
}

export function useDesignSystemSnapshot(enabled = true): SnapshotState & { refreshSnapshot: () => void } {
  const [state, setState] = useState<SnapshotState>({ snapshot: null, isLoading: enabled, error: null });
  const hasRequestedRef = useRef(false);

  const refreshSnapshot = useCallback(() => {
    hasRequestedRef.current = true;
    setState((current) => ({ ...current, isLoading: true, error: null }));
    parent.postMessage({ pluginMessage: { type: "get-design-system-snapshot" } }, "*");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (!msg || msg.type !== "design-system-snapshot-result") return;
      setState({ snapshot: msg.snapshot, isLoading: false, error: null });
    }

    window.addEventListener("message", handleMessage);
    if (!hasRequestedRef.current) {
      hasRequestedRef.current = true;
      parent.postMessage({ pluginMessage: { type: "get-design-system-snapshot" } }, "*");
    }
    const timeout = window.setTimeout(() => {
      setState((current) =>
        current.isLoading
          ? { ...current, isLoading: false, error: "Could not sync with Figma. Try again or check file permissions." }
          : current,
      );
    }, 20000);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [enabled]);

  const autoLoading = enabled && !state.snapshot && !state.error;
  return { ...state, isLoading: state.isLoading || autoLoading, refreshSnapshot };
}
