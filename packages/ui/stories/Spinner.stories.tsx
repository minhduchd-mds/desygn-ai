import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "../src/primitives/index.js";

const meta: Meta<typeof Spinner> = {
  title: "Desygn UI/Spinner",
  component: Spinner,
  argTypes: { size: { control: "select", options: ["sm", "md", "lg"] } },
};
export default meta;

type Story = StoryObj<typeof Spinner>;

export const Medium: Story = { args: { size: "md" } };
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
};
