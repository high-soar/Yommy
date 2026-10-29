import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchNovelCard } from "./SearchNovelCard";
import { sampleSearchItem } from "../types";

const meta: Meta<typeof SearchNovelCard> = {
  title: "Features/Search/SearchNovelCard",
  component: SearchNovelCard,
  parameters: {
    layout: "padded",
  },
  args: {
    item: sampleSearchItem,
    isRegistered: false,
    isAdding: false,
    onAdd: fn(),
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SearchNovelCard>;

export const Default: Story = {
  args: {
    item: sampleSearchItem,
    isRegistered: false,
    isAdding: false,
  },
};

export const Adding: Story = {
  args: {
    item: sampleSearchItem,
    isRegistered: false,
    isAdding: true,
  },
};

export const Registered: Story = {
  args: {
    item: sampleSearchItem,
    isRegistered: true,
    isAdding: false,
  },
};

export const WithoutLastPublished: Story = {
  args: {
    item: {
      ...sampleSearchItem,
      lastEpisodePublishedAt: null,
      tags: [],
    },
    isRegistered: false,
    isAdding: false,
  },
};
