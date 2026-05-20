import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../src/primitives/index.js";

const meta: Meta<typeof Input> = {
  title: "Desygn UI/Input",
  component: Input,
  args: { placeholder: "https://figma.com/file/..." },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "Acme Design System" } };
export const Error: Story = {
  args: { defaultValue: "not-a-url", error: "Enter a valid Figma file URL" },
};
export const Disabled: Story = { args: { disabled: true, defaultValue: "Locked" } };
