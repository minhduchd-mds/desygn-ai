/**
 * Toast component stories.
 *
 * Demonstrates the toast notification system with different types and durations.
 * Install Storybook: npx storybook@latest init --type react_vite
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import React, { useEffect, useState } from "react";

// Inline Toast component for story isolation
function Toast({ message, type = "info", onDismiss }: { message: string; type?: "info" | "success" | "error" | "warning"; onDismiss?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  const typeStyles: Record<string, React.CSSProperties> = {
    info: { background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff" },
    success: { background: "linear-gradient(135deg, #10b981, #34d399)", color: "#fff" },
    error: { background: "linear-gradient(135deg, #ef4444, #f87171)", color: "#fff" },
    warning: { background: "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#1f2937" },
  };

  return (
    <div style={{
      padding: "12px 20px",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 500,
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      animation: "slideIn 0.3s ease",
      ...typeStyles[type],
    }}>
      {message}
    </div>
  );
}

const meta: Meta<typeof Toast> = {
  title: "Components/Toast",
  component: Toast,
  parameters: { layout: "centered" },
  argTypes: {
    type: { control: "select", options: ["info", "success", "error", "warning"] },
    message: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Toast>;

export const Info: Story = { args: { message: "Design.md generated successfully", type: "info" } };
export const Success: Story = { args: { message: "Project saved to history", type: "success" } };
export const Error: Story = { args: { message: "API rate limit exceeded — retry in 30s", type: "error" } };
export const Warning: Story = { args: { message: "Offline mode — changes will sync when connected", type: "warning" } };
