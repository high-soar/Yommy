import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchNovelCard } from "./SearchNovelCard";
import type { NovelSearchResultItem } from "../../../parsers/types";

export const sampleSearchItem: NovelSearchResultItem = {
  remoteWorkId: "16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異世界転生した主人公が古代迷宮を攻略する王道ファンタジー。",
  genre: "fantasy",
  genreLabel: "異世界ファンタジー",
  serialStatus: "running",
  serialStatusLabel: "連載中",
  episodeCount: 45,
  characterCount: 152000,
  tags: ["異世界", "魔法", "チート"],
  reviewPoints: 1250,
  lastEpisodePublishedAt: "2026-10-28T12:00:00Z",
  workUrl: "https://kakuyomu.jp/works/16817330658027210412",
};

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
