import type { PluginMessage } from "../../shared/types";

/**
 * Type-safe wrapper around parent.postMessage for the Figma plugin UI iframe.
 * Centralises the message format so hooks don't repeat the same boilerplate.
 */
export function sendPluginMessage(message: PluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}
