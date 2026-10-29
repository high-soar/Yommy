import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { RankingFilterBar } from "./RankingFilterBar";

const meta: Meta<typeof RankingFilterBar> = {
  title: "Features/Ranking/RankingFilterBar",
  component: RankingFilterBar,
  parameters: {
    layout: "padded",
  },
  args: {
    selectedPeriod: "weekly",
    onSelectPeriod: fn(),
    selectedGenre: undefined,
    onSelectGenre: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RankingFilterBar>;

export const Default: Story = {
  args: {
    selectedPeriod: "weekly",
    selectedGenre: undefined,
  },
};

export const Filtered: Story = {
  args: {
    selectedPeriod: "monthly",
    selectedGenre: "fantasy",
  },
};
