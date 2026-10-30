import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { RankingContainer } from "./RankingContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import rankingApolloHtml from "../../../parsers/kakuyomu/__fixtures__/ranking_results_apollo.html?raw";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";

function createMockHttpClient(): MockHttpClient {
  const client = new MockHttpClient();
  client.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, (options) => ({
    status: 200,
    url: options.url,
    headers: {},
    html: rankingApolloHtml,
  }));
  client.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, (options) => ({
    status: 200,
    url: options.url,
    headers: {},
    html: workIndexHtml,
  }));
  return client;
}

const meta: Meta<typeof RankingContainer> = {
  title: "Features/Ranking/RankingContainer",
  component: RankingContainer,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <ServiceProvider services={{ httpClient: createMockHttpClient() }}>
        <RouterProvider initialPath="/ranking">
          <Story />
        </RouterProvider>
      </ServiceProvider>
    ),
  ],
  args: {
    onSelectNovel: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RankingContainer>;

/**
 * ランキングコンテナ（モックHTTPサービス・ルーター連携）
 */
export const Default: Story = {
  name: "デフォルト（ランキングコンテナ統合表示）",
};
