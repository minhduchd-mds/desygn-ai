/**
 * workspace-store — Centralized state management for the Desygn AI workspace.
 *
 * Replaces the 60+ useState calls in main.tsx with a structured store pattern.
 * Uses pub/sub for cross-module communication without prop drilling.
 *
 * Architecture:
 *   Store slices → Subscribers → React hooks → Components
 *   Each slice is independently testable and serializable.
 */

import { eventBus } from "../lib/eventBus";

// ── Types ──────────────────────────────────────────────────────

export type AppView = "landing" | "workspace" | "auth";
export type WorkspaceTab = "chat" | "code" | "checklist";
export type Theme = "dark" | "light";
export type PreviewMode = "prompt" | "preview" | "edit" | "split";

export interface WorkspaceState {
  view: AppView;
  tab: WorkspaceTab;
  theme: Theme;
  previewMode: PreviewMode;
  sidebarCollapsed: boolean;
  isGenerating: boolean;
  hasGenerated: boolean;
}

export interface ProjectState {
  activeProjectId: string | null;
  projects: Array<{ id: string; name: string; createdAt: string }>;
}

export interface UIState {
  settingsOpen: boolean;
  templatePopupOpen: boolean;
  setupModalOpen: boolean;
  brandMenuOpen: boolean;
}

// ── Store Implementation ──────────────────────────────────────

type Listener<T> = (state: T) => void;

export class Store<T extends object> {
  private state: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initial: T) {
    this.state = { ...initial };
  }

  getState(): Readonly<T> {
    return this.state;
  }

  setState(partial: Partial<T>): void {
    const prev = this.state;
    this.state = { ...prev, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Reset to initial state (useful for logout) */
  reset(initial: T): void {
    this.state = { ...initial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

// ── Default States ────────────────────────────────────────────

const DEFAULT_WORKSPACE: WorkspaceState = {
  view: "landing",
  tab: "chat",
  theme: "dark",
  previewMode: "prompt",
  sidebarCollapsed: false,
  isGenerating: false,
  hasGenerated: false,
};

const DEFAULT_PROJECT: ProjectState = {
  activeProjectId: null,
  projects: [],
};

const DEFAULT_UI: UIState = {
  settingsOpen: false,
  templatePopupOpen: false,
  setupModalOpen: false,
  brandMenuOpen: false,
};

// ── Store Instances (singletons) ─────────────────────────────

export const workspaceStore = new Store<WorkspaceState>(DEFAULT_WORKSPACE);
export const projectStore = new Store<ProjectState>(DEFAULT_PROJECT);
export const uiStore = new Store<UIState>(DEFAULT_UI);

// ── Hydrate from localStorage ─────────────────────────────────

export function hydrateStores(): void {
  const theme = localStorage.getItem("designready.theme") as Theme | null;
  if (theme) workspaceStore.setState({ theme });

  const projects = localStorage.getItem("designready.projects-v1");
  if (projects) {
    try {
      projectStore.setState({ projects: JSON.parse(projects) });
    } catch { /* ignore */ }
  }
}

// ── Persist middleware ─────────────────────────────────────────

export function setupPersistence(): () => void {
  const unsub1 = workspaceStore.subscribe((state) => {
    localStorage.setItem("designready.theme", state.theme);
  });

  const unsub2 = projectStore.subscribe((state) => {
    localStorage.setItem("designready.projects-v1", JSON.stringify(state.projects));
  });

  return () => { unsub1(); unsub2(); };
}

// ── Actions (side-effect free) ────────────────────────────────

export const workspaceActions = {
  setView(view: AppView) { workspaceStore.setState({ view }); },
  setTab(tab: WorkspaceTab) { workspaceStore.setState({ tab }); },
  toggleTheme() {
    const current = workspaceStore.getState().theme;
    workspaceStore.setState({ theme: current === "dark" ? "light" : "dark" });
  },
  setGenerating(isGenerating: boolean) { workspaceStore.setState({ isGenerating }); },
  toggleSidebar() {
    workspaceStore.setState({ sidebarCollapsed: !workspaceStore.getState().sidebarCollapsed });
  },
};

export const projectActions = {
  addProject(name?: string) {
    const state = projectStore.getState();
    const id = `proj-${Date.now()}`;
    const project = { id, name: name ?? `Project ${state.projects.length + 1}`, createdAt: new Date().toISOString() };
    projectStore.setState({
      projects: [project, ...state.projects],
      activeProjectId: id,
    });
    eventBus.emit("toast:show", { message: "Project created", type: "success" });
    return id;
  },

  renameProject(id: string, name: string) {
    const state = projectStore.getState();
    projectStore.setState({
      projects: state.projects.map(p => p.id === id ? { ...p, name } : p),
    });
  },

  deleteProject(id: string) {
    const state = projectStore.getState();
    projectStore.setState({
      projects: state.projects.filter(p => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    });
  },

  setActive(id: string | null) {
    projectStore.setState({ activeProjectId: id });
  },
};

export const uiActions = {
  openSettings() { uiStore.setState({ settingsOpen: true }); },
  closeSettings() { uiStore.setState({ settingsOpen: false }); },
  toggleTemplatePopup() { uiStore.setState({ templatePopupOpen: !uiStore.getState().templatePopupOpen }); },
  toggleBrandMenu() { uiStore.setState({ brandMenuOpen: !uiStore.getState().brandMenuOpen }); },
};
