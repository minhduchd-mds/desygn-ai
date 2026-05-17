/**
 * Tests for workspace-store module.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Store, workspaceStore, projectStore, uiStore, workspaceActions, projectActions, uiActions } from "../../workspace-store";

describe("Store", () => {
  it("initializes with default state", () => {
    const store = new Store({ count: 0, name: "test" });
    expect(store.getState()).toEqual({ count: 0, name: "test" });
  });

  it("updates state with partial", () => {
    const store = new Store({ a: 1, b: 2 });
    store.setState({ a: 10 });
    expect(store.getState()).toEqual({ a: 10, b: 2 });
  });

  it("notifies subscribers on state change", () => {
    const store = new Store({ value: "initial" });
    const states: string[] = [];
    store.subscribe(s => states.push(s.value));
    store.setState({ value: "updated" });
    expect(states).toEqual(["updated"]);
  });

  it("unsubscribe stops notifications", () => {
    const store = new Store({ x: 0 });
    let count = 0;
    const unsub = store.subscribe(() => { count++; });
    store.setState({ x: 1 });
    unsub();
    store.setState({ x: 2 });
    expect(count).toBe(1);
  });

  it("reset returns to initial state", () => {
    const store = new Store({ x: 0 });
    store.setState({ x: 99 });
    store.reset({ x: 0 });
    expect(store.getState().x).toBe(0);
  });
});

describe("workspaceStore", () => {
  beforeEach(() => {
    workspaceStore.reset({
      view: "landing",
      tab: "chat",
      theme: "dark",
      previewMode: "prompt",
      sidebarCollapsed: false,
      isGenerating: false,
      hasGenerated: false,
    });
  });

  it("has correct initial state", () => {
    expect(workspaceStore.getState().view).toBe("landing");
    expect(workspaceStore.getState().theme).toBe("dark");
  });

  it("setView updates view", () => {
    workspaceActions.setView("workspace");
    expect(workspaceStore.getState().view).toBe("workspace");
  });

  it("setTab updates tab", () => {
    workspaceActions.setTab("code");
    expect(workspaceStore.getState().tab).toBe("code");
  });

  it("toggleTheme switches between dark and light", () => {
    workspaceActions.toggleTheme();
    expect(workspaceStore.getState().theme).toBe("light");
    workspaceActions.toggleTheme();
    expect(workspaceStore.getState().theme).toBe("dark");
  });

  it("toggleSidebar switches collapsed state", () => {
    workspaceActions.toggleSidebar();
    expect(workspaceStore.getState().sidebarCollapsed).toBe(true);
  });
});

describe("projectStore", () => {
  beforeEach(() => {
    projectStore.reset({ activeProjectId: null, projects: [] });
  });

  it("addProject creates project and sets active", () => {
    const id = projectActions.addProject("Test Project");
    expect(id).toBeTruthy();
    expect(projectStore.getState().projects.length).toBe(1);
    expect(projectStore.getState().activeProjectId).toBe(id);
  });

  it("renameProject updates name", () => {
    const id = projectActions.addProject("Old Name");
    projectActions.renameProject(id, "New Name");
    expect(projectStore.getState().projects[0].name).toBe("New Name");
  });

  it("deleteProject removes and clears active if needed", () => {
    const id = projectActions.addProject("ToDelete");
    projectActions.deleteProject(id);
    expect(projectStore.getState().projects.length).toBe(0);
    expect(projectStore.getState().activeProjectId).toBe(null);
  });

  it("setActive changes active project", () => {
    const id1 = projectActions.addProject("P1");
    const id2 = projectActions.addProject("P2");
    projectActions.setActive(id1);
    expect(projectStore.getState().activeProjectId).toBe(id1);
  });
});

describe("uiStore", () => {
  beforeEach(() => {
    uiStore.reset({
      settingsOpen: false,
      templatePopupOpen: false,
      setupModalOpen: false,
      brandMenuOpen: false,
    });
  });

  it("openSettings sets settingsOpen to true", () => {
    uiActions.openSettings();
    expect(uiStore.getState().settingsOpen).toBe(true);
  });

  it("closeSettings sets settingsOpen to false", () => {
    uiActions.openSettings();
    uiActions.closeSettings();
    expect(uiStore.getState().settingsOpen).toBe(false);
  });

  it("toggleTemplatePopup toggles state", () => {
    uiActions.toggleTemplatePopup();
    expect(uiStore.getState().templatePopupOpen).toBe(true);
    uiActions.toggleTemplatePopup();
    expect(uiStore.getState().templatePopupOpen).toBe(false);
  });
});
