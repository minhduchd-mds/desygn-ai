import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../src/primitives/index.js";

const meta: Meta<typeof Badge> = {
  title: "Desygn UI/Badge",
  component: Badge,
  args: { children: "WCAG 2.2 AA" },
  argTypes: {
    tone: { control: "select", options: ["neutral", "success", "warning", "error", "info"] },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Neutral: Story = { args: { tone: "neutral" } };
export const Severities: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8 }}>
      <Badge tone="error">Critical</Badge>
      <Badge tone="warning">Serious</Badge>
      <Badge tone="info">Moderate</Badge>
      <Badge tone="neutral">Minor</Badge>
      <Badge tone="success">Passed</Badge>
    </div>
  ),
};
