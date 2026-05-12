import { useEffect, useState } from "react";

interface FigmaColorVariablesState {
  tokens: Record<string, string>;
  fileName: string;
  count: number;
  isLoading: boolean;
}

export function useFigmaColorVariables(): FigmaColorVariablesState {
  const [state, setState] = useState<FigmaColorVariablesState>({
    tokens: {},
    fileName: "",
    count: 0,
    isLoading: true,
  });

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data?.pluginMessage;
      if (!msg || msg.type !== "figma-color-variables-result") return;
      setState({
        tokens: msg.tokens ?? {},
        fileName: msg.fileName ?? "",
        count: msg.count ?? Object.keys(msg.tokens ?? {}).length,
        isLoading: false,
      });
    }

    window.addEventListener("message", handleMessage);
    parent.postMessage({ pluginMessage: { type: "get-figma-color-variables" } }, "*");

    const timeout = window.setTimeout(() => {
      setState((current) => current.isLoading ? { ...current, isLoading: false } : current);
    }, 5000);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeout);
    };
  }, []);

  return state;
}
