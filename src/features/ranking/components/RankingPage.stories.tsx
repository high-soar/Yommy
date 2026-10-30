import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { RankingPage } from "./RankingPage";
import {
  sampleRankingItem1,
  sampleRankingItem2,
  sampleRankingItem3,
  sampleRankingItem4,
} from "../types";

const meta: Meta<typeof RankingPage> = {
  title: "Features/Ranking/RankingPage",
  component: RankingPage,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    selectedSite: "kakuyomu",
    onSelectSite: fn(),
    selectedPeriod: "weekly",
    onSelectPeriod: fn(),
    selectedGenre: undefined,
    onSelectGenre: fn(),
    items: [],
    registeredWorkIds: new Set<string>(),
    addingWorkId: null,
    isLoading: false,
    error: null,
    onRetry: fn(),
    onAddNovel: fn(),
    onSelectCard: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RankingPage>;

/**
 * ランキング画面（総合・週間ランキング初期表示）
 */
export const WeeklyOverall: Story = {
  name: "総合週間ランキング（初期表示）",
  args: {
    selectedPeriod: "weekly",
    selectedGenre: undefined,
    items: [
      sampleRankingItem1,
      sampleRankingItem2,
      sampleRankingItem3,
      sampleRankingItem4,
    ],
    registeredWorkIds: new Set<string>(),
    isLoading: false,
  },
};

/**
 * ランキング画面（異世界ファンタジー・月間ジャンル別表示）
 */
export const GenreFantasy: Story = {
  name: "ジャンル別ランキング（異世界ファンタジー・月間）",
  args: {
    selectedPeriod: "monthly",
    selectedGenre: "fantasy",
    items: [sampleRankingItem1],
    registeredWorkIds: new Set<string>(),
    isLoading: false,
  },
};

/**
 * ランキング画面（上位順位バッジおよび本棚登録済み作品混在表示）
 */
export const MixedRegistration: Story = {
  name: "上位順位バッジ・登録済み混在表示",
  args: {
    selectedPeriod: "weekly",
    selectedGenre: undefined,
    items: [
      sampleRankingItem1,
      sampleRankingItem2,
      sampleRankingItem3,
      sampleRankingItem4,
    ],
    registeredWorkIds: new Set([sampleRankingItem2.remoteWorkId]),
    addingWorkId: sampleRankingItem1.remoteWorkId,
    isLoading: false,
  },
};

/**
 * ランキング画面（データ取得中ローディング表示）
 */
export const Loading: Story = {
  name: "ランキング取得中ローディング",
  args: {
    selectedPeriod: "weekly",
    items: [],
    isLoading: true,
  },
};

/**
 * ランキング画面（対象期間・ジャンルのランキング0件空状態）
 */
export const Empty: Story = {
  name: "ランキング0件空状態",
  args: {
    selectedPeriod: "daily",
    selectedGenre: "criticism",
    items: [],
    isLoading: false,
  },
};

/**
 * ランキング画面（通信エラー・再試行ボタン表示状態）
 */
export const ErrorState: Story = {
  name: "通信エラー状態",
  args: {
    selectedPeriod: "weekly",
    items: [],
    error:
      "ランキングの取得に失敗しました。ネットワーク接続を確認してください。",
  },
};
