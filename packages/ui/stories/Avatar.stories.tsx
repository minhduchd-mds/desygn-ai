import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../src/primitives/index.js";

const meta: Meta<typeof Avatar> = {
  title: "Desygn UI/Avatar",
  component: Avatar,
  args: { name: "Minh Duc" },
  argTypes: { size: { control: "select", options: ["sm", "md", "lg"] } },
};
export default meta;

type Story = StoryObj<typeof Avatar>;

export const Initials: Story = {};
export const WithImage: Story = {
  args: { src: "https://avatars.githubusercontent.com/u/9919?s=200" },
};
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar name="Alex Kim" size="sm" />
      <Avatar name="Sarah Lee" size="md" />
      <Avatar name="Ada Lovelace" size="lg" />
    </div>
  ),
};
