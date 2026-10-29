import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchFilterBar } from "./SearchFilterBar";

const meta: Meta<typeof SearchFilterBar> = {
  title: "Features/Search/SearchFilterBar",
  component: SearchFilterBar,
  parameters: {
    layout: "padded",
  },
  args: {
    selectedOrder: "weekly_ranking",
    onSelectOrder: fn(),
    selectedSerialStatus: "all",
    onSelectSerialStatus: fn(),
    selectedGenre: undefined,
    onSelectGenre: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SearchFilterBar>;

export const Default: Story = {
  args: {
    selectedOrder: "weekly_ranking",
    selectedSerialStatus: "all",
    selectedGenre: undefined,
  },
};

export const Filtered: Story = {
  args: {
    selectedOrder: "popular",
    selectedSerialStatus: "running",
    selectedGenre: "fantasy",
  },
};
