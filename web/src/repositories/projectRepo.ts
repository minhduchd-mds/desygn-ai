/**
 * projectRepo — repository for project version storage.
 *
 * Wraps supabase.ts with:
 *  • eventBus notifications on key operations
 *  • Consistent error handling via errorBus
 *  • Type-safe interface for callers
 *
 * Swap backend: change saveProjectVersion / loadLatestVersion in supabase.ts,
 * everything above this layer stays the same.
 */

import {
  saveProjectVersion as supabaseSave,
  loadLatestVersion,
  listVersions,
  type ProjectVersion,
} from "../lib/supabase";
import type { Screen } from "../../../shared/designContext";
import { eventBus } from "../lib/eventBus";
import { errorBus } from "../lib/errorBus";

export type { ProjectVersion };

export const projectRepo = {
  /**
   * Persist a new version snapshot for a project.
   * Emits "project:updated" on success.
   */
  async save(projectId: string, designMd: string, screens: Screen[]): Promise<void> {
    try {
      await supabaseSave(projectId, designMd, screens);
      eventBus.emit("project:updated", { name: projectId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save project";
      errorBus.warn("PROJECT_SAVE_ERROR", message, { projectId });
      // Re-throw so callers can show error UI
      throw err;
    }
  },

  /**
   * Load the most recent version of a project.
   * Returns null if nothing is saved yet.
   */
  async loadLatest(projectId: string): Promise<ProjectVersion | null> {
    try {
      return await loadLatestVersion(projectId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load project";
      errorBus.warn("PROJECT_LOAD_ERROR", message, { projectId });
      return null;
    }
  },

  /**
   * List all saved versions for a project (newest first).
   */
  async listVersions(projectId: string): Promise<ProjectVersion[]> {
    try {
      return await listVersions(projectId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list versions";
      errorBus.warn("PROJECT_LIST_ERROR", message, { projectId });
      return [];
    }
  },
};
