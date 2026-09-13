import { useState, useEffect, useCallback } from "react";
import type { SerializedNode } from "../../shared/types";

function isTrustedFigmaMessage(event: MessageEvent): boolean {
  if (event.source !== parent) return false;
  return event.origin === "null" || event.origin === "https://www.figma.com";
}

export function useSelection() {
  const [selectedNode, setSelectedNode] = useState<SerializedNode | null>(null);
  const [selectionName, setSelectionName] = useState("");
  const [selectionCount, setSelectionCount] = useState(0);

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: "request-selection" } }, "*");
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isTrustedFigmaMessage(event)) return;
      const msg = event.data?.pluginMessage;
      if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
      if (msg.type === "selection-change") {
        setSelectedNode(msg.node ?? null);
        setSelectionName(typeof msg.name === "string" ? msg.name : "");
        setSelectionCount(typeof msg.selectionCount === "number" ? msg.selectionCount : 1);
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
