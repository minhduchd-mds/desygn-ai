import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "../src/primitives/index.js";

const meta: Meta<typeof Switch> = {
  title: "Desygn UI/Switch",
  component: Switch,
  args: { label: "Block PR on failing audit" },
};
export default meta;

type Story = StoryObj<typeof Switch>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
