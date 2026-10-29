import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SiteSelector } from "./SiteSelector";

const meta: Meta<typeof SiteSelector> = {
  title: "Features/Ranking/SiteSelector",
  component: SiteSelector,
  parameters: {
    layout: "centered",
  },
  args: {
    selectedSite: "kakuyomu",
    onSelectSite: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SiteSelector>;

export const Default: Story = {
  args: {
    selectedSite: "kakuyomu",
  },
};

export const NarouSelected: Story = {
  args: {
    selectedSite: "narou",
  },
};
