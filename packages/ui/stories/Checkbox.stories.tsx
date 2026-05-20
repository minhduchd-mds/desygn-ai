import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../src/primitives/index.js";

const meta: Meta<typeof Checkbox> = {
  title: "Desygn UI/Checkbox",
  component: Checkbox,
  args: { label: "Include AAA-level checks" },
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };
export const NoLabel: Story = { args: { label: undefined, "aria-label": "Select row" } };
