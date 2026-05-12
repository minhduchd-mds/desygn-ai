import { useState, useEffect, useCallback } from "react";
import type { SerializedNode } from "../../shared/types";

export function useSelection() {
  const [selectedNode, setSelectedNode] = useState<SerializedNode | null>(null);
  const [selectionName, setSelectionName] = useState("");
  const [selectionCount, setSelectionCount] = useState(0);

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: "request-selection" } }, "*");
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === "selection-change") {
        setSelectedNode(msg.node);
        setSelectionName(msg.name);
        setSelectionCount(msg.selectionCount ?? 1);
      } else if (msg.type === "no-selection") {
        setSelectedNode(null);
        setSelectionName("");
        setSelectionCount(0);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const refreshSelection = useCallback(() => {
    parent.postMessage({ pluginMessage: { type: "request-selection" } }, "*");
  }, []);

  return { selectedNode, selectionName, selectionCount, refreshSelection };
}
