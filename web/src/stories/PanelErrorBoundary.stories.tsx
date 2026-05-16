/**
 * PanelErrorBoundary component stories.
 *
 * Demonstrates the scoped error boundary behavior.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { PanelErrorBoundary } from "../workspace/PanelErrorBoundary";

function ThrowingComponent(): React.ReactElement {
  throw new Error("Simulated panel crash for Storybook demo");
}

function WorkingComponent(): React.ReactElement {
  return (
    <div style={{ padding: 24, background: "rgba(99, 102, 241, 0.1)", borderRadius: 8 }}>
      <h3 style={{ color: "#a5b4fc", margin: 0 }}>Panel Content</h3>
      <p style={{ color: "#94a3b8", marginTop: 8 }}>This panel is working correctly.</p>
    </div>
  );
}

const meta: Meta<typeof PanelErrorBoundary> = {
  title: "Components/PanelErrorBoundary",
  component: PanelErrorBoundary,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof PanelErrorBoundary>;

export const Healthy: Story = {
  args: { panelName: "Design Preview" },
  render: (args) => (
    <PanelErrorBoundary {...args}>
      <WorkingComponent />
    </PanelErrorBoundary>
  ),
};

export const Crashed: Story = {
  args: { panelName: "Chat Workspace" },
  render: (args) => (
    <PanelErrorBoundary {...args}>
      <ThrowingComponent />
    </PanelErrorBoundary>
  ),
};
