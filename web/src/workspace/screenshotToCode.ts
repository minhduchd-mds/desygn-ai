/// <reference types="vite/client" />
import { WS_TIMEOUT_MS } from "../design/constants";

export interface ScreenshotToCodeOptions {
  imageDataUrl: string;
  inputMode?: "image";
  stack?: "react_tailwind" | "html_tailwind";
  wsUrl?: string;
}

export interface ScreenshotToCodeResult {
  code: string;
  rawMessages: string[];
}

interface ScreenshotToCodeMessage {
  type?: string;
  value?: string;
  error?: string;
}

export function getScreenshotToCodeWsUrl() {
  return import.meta.env.VITE_SCREENSHOT_TO_CODE_WS_URL || "";
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

export function generateCodeFromScreenshot({
  imageDataUrl,
  inputMode = "image",
  stack = "react_tailwind",
  wsUrl = getScreenshotToCodeWsUrl(),
}: ScreenshotToCodeOptions): Promise<ScreenshotToCodeResult> {
  return new Promise((resolve, reject) => {
    if (!wsUrl) {
      reject(new Error("The screenshot-to-code backend is not configured. Add VITE_SCREENSHOT_TO_CODE_WS_URL, for example ws://127.0.0.1:7001/generate-code, after the backend is running."));
      return;
    }

    const socket = new WebSocket(wsUrl);
    const rawMessages: string[] = [];
    let latestCode = "";
    let settled = false;

    const finish = (result: ScreenshotToCodeResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(failTimer);
      resolve(result);
      socket.close();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(failTimer);
      reject(error);
      socket.close();
    };

    const failTimer = window.setTimeout(() => {
      fail(new Error(`Could not connect to the screenshot-to-code backend at ${wsUrl}. Start the backend or configure VITE_SCREENSHOT_TO_CODE_WS_URL.`));
    }, WS_TIMEOUT_MS);

    socket.addEventListener("open", () => {
      window.clearTimeout(failTimer);
      socket.send(
        JSON.stringify({
          generationType: "create",
          image: imageDataUrl,
          inputMode,
          generatedCodeConfig: stack,
          isImageGenerationEnabled: false,
          openAiApiKey: null,
          openAiBaseURL: null,
          screenshotOneApiKey: null,
        }),
      );
    });

    socket.addEventListener("message", (event) => {
      const raw = String(event.data);
      rawMessages.push(raw);

      try {
        const message = JSON.parse(raw) as ScreenshotToCodeMessage;
        if (message.type === "error" || message.error) {
          fail(new Error(message.value || message.error || "The screenshot-to-code backend returned an error."));
          return;
        }

        if (message.type === "setCode" && message.value) {
          latestCode = message.value;
        }

        if (message.type === "status" && /complete|done|finish/i.test(message.value ?? "") && latestCode) {
          finish({ code: latestCode, rawMessages });
        }
      } catch {
        if (raw.includes("<html") || raw.includes("function ") || raw.includes("export default")) {
          latestCode = raw;
        }
      }
    });

    socket.addEventListener("close", () => {
      window.clearTimeout(failTimer);
      if (!settled && latestCode) {
        finish({ code: latestCode, rawMessages });
      }
    });

    socket.addEventListener("error", () => {
      fail(new Error(`Could not connect to the screenshot-to-code backend at ${wsUrl}. Start the screenshot-to-code backend before generating.`));
    });
  });
}
