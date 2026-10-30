import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchContainer } from "./SearchContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import searchApolloHtml from "../../../parsers/kakuyomu/__fixtures__/search_results_apollo.html?raw";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";

function createMockHttpClient(): MockHttpClient {
  const client = new MockHttpClient();
  client.setResponse(/^https:\/\/kakuyomu\.jp\/search/, (options) => ({
    status: 200,
    url: options.url,
    headers: {},
    html: searchApolloHtml,
  }));
  client.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, (options) => ({
    status: 200,
    url: options.url,
    headers: {},
    html: workIndexHtml,
  }));
  return client;
}

const meta: Meta<typeof SearchContainer> = {
  title: "Features/Search/SearchContainer",
  component: SearchContainer,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <ServiceProvider services={{ httpClient: createMockHttpClient() }}>
        <RouterProvider initialPath="/search">
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
type Story = StoryObj<typeof SearchContainer>;

/**
 * 検索コンテナ（モックHTTPサービス・ルーター連携）
 */
export const Default: Story = {
  name: "デフォルト（検索コンテナ統合表示）",
};
