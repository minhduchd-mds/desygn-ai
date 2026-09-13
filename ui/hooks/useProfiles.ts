import { useState, useEffect, useCallback } from "react";
import type { PluginProfile } from "../../shared/types";

function isTrustedFigmaMessage(event: MessageEvent): boolean {
  if (event.source !== parent) return false;
  return event.origin === "null" || event.origin === "https://www.figma.com";
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<PluginProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isTrustedFigmaMessage(event)) return;
      const msg = event.data?.pluginMessage;
      if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
      if (msg.type === "profiles-loaded" && Array.isArray(msg.profiles)) {
        setProfiles(msg.profiles);
        setActiveId(typeof msg.activeId === "string" ? msg.activeId : null);
      }
      if (msg.type === "profile-saved" && Array.isArray(msg.profiles)) {
        setProfiles(msg.profiles);
        setActiveId((prev) => prev && !msg.profiles.find((p: PluginProfile) => p.id === prev) ? null : prev);
      }
    }
    window.addEventListener("message", handleMessage);
    // Request profiles on mount
    parent.postMessage({ pluginMessage: { type: "load-profiles" } }, "*");
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  const saveProfile = useCallback((profile: PluginProfile) => {
    parent.postMessage({ pluginMessage: { type: "save-profile", profile } }, "*");
    // Automatically set as active
    setActiveId(profile.id);
    parent.postMessage({ pluginMessage: { type: "set-active-profile", profileId: profile.id } }, "*");
  }, []);

  const selectProfile = useCallback((profileId: string | null) => {
    setActiveId(profileId);
    parent.postMessage({ pluginMessage: { type: "set-active-profile", profileId } }, "*");
  }, []);

  const deleteProfile = useCallback(
    (profileId: string) => {
      parent.postMessage({ pluginMessage: { type: "delete-profile", profileId } }, "*");
      if (activeId === profileId) {
        setActiveId(null);
      }
    },
    [activeId],
  );

  return { profiles, activeProfile, activeId, saveProfile, selectProfile, deleteProfile };
}
