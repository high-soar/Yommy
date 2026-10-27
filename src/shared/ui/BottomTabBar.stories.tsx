import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { BottomTabBar } from "./BottomTabBar";

const meta: Meta<typeof BottomTabBar> = {
  title: "Shared/BottomTabBar",
  component: BottomTabBar,
  decorators: [
    (Story) => (
      <div className="w-full max-w-md mx-auto bg-slate-50 dark:bg-slate-950 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    activeTab: "bookshelf",
    onSelectBookshelf: fn(),
    onSelectSettings: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof BottomTabBar>;

/**
 * 本棚タブがアクティブな状態のストーリー
 */
export const BookshelfActive: Story = {
  name: "本棚タブアクティブ",
  args: {
    activeTab: "bookshelf",
  },
};

/**
 * 設定タブがアクティブな状態のストーリー
 */
export const SettingsActive: Story = {
  name: "設定タブアクティブ",
  args: {
    activeTab: "settings",
  },
};
