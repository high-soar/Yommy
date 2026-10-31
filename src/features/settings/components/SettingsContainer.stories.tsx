import type { Meta, StoryObj } from "@storybook/react";
import { SettingsContainer } from "./SettingsContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import type {
  ReaderSettings,
  SettingsRepository,
} from "../../../storage/types";

/**
 * Storybook 用のインメモリ SettingsRepository モックファクトリ
 */
export function createMockSettingsRepository(
  initialSettings?: Partial<ReaderSettings>,
): SettingsRepository {
  let settingsState: ReaderSettings = {
    writingMode: "vertical-rl",
    theme: "light",
    fontFamily: "mincho",
    fontSizePx: 18,
    lineHeight: 1.8,
    pageMarginPx: 16,
    enableTapPaging: true,
    enableVolumeKeyPaging: false,
    pagingMode: "auto",
    updatedAt: "2026-10-27T00:00:00Z",
    ...initialSettings,
  };

  return {
    getReaderSettings: async () => ({ ...settingsState }),
    updateReaderSettings: async (patch) => {
      settingsState = { ...settingsState, ...patch };
      return { ...settingsState };
    },
  };
}

const meta: Meta<typeof SettingsContainer> = {
  title: "Settings/SettingsContainer",
  component: SettingsContainer,
  parameters: {
    layout: "fullscreen",
  },
  excludeStories: ["createMockSettingsRepository"],
  decorators: [
    (Story) => (
      <ServiceProvider
        services={{
          settingsRepository: createMockSettingsRepository(),
        }}
      >
        <Story />
      </ServiceProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SettingsContainer>;

/**
 * デフォルト表示（縦書き・ライトテーマ、文字サイズ 18px、行間 1.8）
 */
export const Default: Story = {
  name: "デフォルト表示",
};

/**
 * カスタムクラス適用表示
 */
export const WithCustomClass: Story = {
  name: "カスタムクラス適用表示",
  args: {
    className: "custom-settings-container",
  },
};
