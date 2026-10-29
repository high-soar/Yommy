import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchInputBar } from "./SearchInputBar";

const meta: Meta<typeof SearchInputBar> = {
  title: "Features/Search/SearchInputBar",
  component: SearchInputBar,
  parameters: {
    layout: "padded",
  },
  args: {
    keyword: "",
    onChangeKeyword: fn(),
    onSubmitSearch: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SearchInputBar>;

export const Empty: Story = {
  args: {
    keyword: "",
  },
};

export const WithKeyword: Story = {
  args: {
    keyword: "異世界 魔法",
  },
};
