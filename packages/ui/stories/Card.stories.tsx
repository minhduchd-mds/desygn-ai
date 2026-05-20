import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "../src/primitives/index.js";

const meta: Meta<typeof Card> = {
  title: "Desygn UI/Card",
  component: Card,
  argTypes: {
    variant: { control: "select", options: ["default", "elevated", "outlined"] },
  },
};
export default meta;

type Story = StoryObj<typeof Card>;

const Body = () => (
  <div>
    <h3 style={{ margin: 0 }}>Accessibility score</h3>
    <p style={{ margin: "8px 0 0", color: "var(--color-slate-600)" }}>
      87 / 100 — 3 serious issues found.
    </p>
  </div>
);

export const Default: Story = { args: { variant: "default", children: <Body /> } };
export const Elevated: Story = { args: { variant: "elevated", children: <Body /> } };
export const Outlined: Story = { args: { variant: "outlined", children: <Body /> } };
