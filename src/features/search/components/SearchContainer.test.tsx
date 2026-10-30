import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchContainer.stories";
import { SearchContainer } from "./SearchContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import searchApolloHtml from "../../../parsers/kakuyomu/__fixtures__/search_results_apollo.html?raw";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";

const { Default } = composeStories(stories);

describe("SearchContainer コンポーネント", () => {
  let mockHttpClient: MockHttpClient;

  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();

    mockHttpClient = new MockHttpClient();
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/search/,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: searchApolloHtml,
      }),
    );
    mockHttpClient.setResponse(
      /^https:\/\/kakuyomu\.jp\/works\/\d+$/,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: workIndexHtml,
      }),
    );
  });

  const renderWithProviders = (props = {}) => {
    return render(
      <ServiceProvider services={{ httpClient: mockHttpClient }}>
        <RouterProvider initialPath="/search">
          <SearchContainer {...props} />
        </RouterProvider>
      </ServiceProvider>,
    );
  };

  it("Default ストーリー: 検索画面の初期未検索状態がレンダリングされること", async () => {
    render(<Default />);

    await waitFor(() => {
      expect(screen.getByTestId("search-page")).toBeInTheDocument();
    });
    expect(screen.getByTestId("search-initial-state")).toBeInTheDocument();
  });

  it("検索実行前に入力欄へキーワードを入力しても初期状態表示が維持されること", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    const input = screen.getByTestId("search-input");
    await user.type(input, "異世界");

    expect(screen.getByTestId("search-initial-state")).toBeInTheDocument();
    expect(screen.queryByTestId("search-empty-state")).not.toBeInTheDocument();
  });

  it("キーワードを入力して検索を実行し、カード一覧が表示されること (AC-SE-02)", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    const input = screen.getByTestId("search-input");
    await user.type(input, "異世界");

    const submitBtn = screen.getByTestId("search-submit-button");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("search-results-list")).toBeInTheDocument();
    });
  });

  it("カードの「＋ 本棚に追加」ボタンを押下すると本棚に登録され「✓ 登録済み」となること (AC-SE-06)", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    const input = screen.getByTestId("search-input");
    await user.type(input, "異世界{Enter}");

    await waitFor(() => {
      expect(
        screen.getAllByTestId("search-card-add-button").length,
      ).toBeGreaterThan(0);
    });

    const addButtons = screen.getAllByTestId("search-card-add-button");
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(
        screen.getByTestId("search-card-registered-button"),
      ).toBeInTheDocument();
    });
  });

  it("カスタム onSelectNovel が提供されている場合、カード本体タップ時にそれが呼ばれること", async () => {
    const user = userEvent.setup();
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    const input = screen.getByTestId("search-input");
    await user.type(input, "異世界{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("search-results-list")).toBeInTheDocument();
    });

    // 最初のカードを取得
    const cards = screen.getAllByTestId(/^search-novel-card-/);
    await user.click(cards[0]);

    await waitFor(() => {
      expect(handleSelectNovel).toHaveBeenCalled();
    });
  });

  it("登録済み作品カードをカスタム onSelectNovel 存在時にタップすると直接コールバックが呼ばれること", async () => {
    const user = userEvent.setup();
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    const input = screen.getByTestId("search-input");
    await user.type(input, "異世界{Enter}");

    await waitFor(() => {
      expect(
        screen.getAllByTestId("search-card-add-button").length,
      ).toBeGreaterThan(0);
    });

    // まず本棚に追加して登録済みにする
    const addButtons = screen.getAllByTestId("search-card-add-button");
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(
        screen.getByTestId("search-card-registered-button"),
      ).toBeInTheDocument();
    });

    // 登録済みカード本体をタップ
    const cards = screen.getAllByTestId(/^search-novel-card-/);
    await user.click(cards[0]);

    expect(handleSelectNovel).toHaveBeenCalledWith(
      expect.stringContaining("kakuyomu:"),
    );
  });

  it("カスタム onSelectNovel が未指定（デフォルト）の場合、カード本体タップで router の詳細画面へ遷移すること", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    const input = screen.getByTestId("search-input");
    await user.type(input, "異世界{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("search-results-list")).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId(/^search-novel-card-/);
    await user.click(cards[0]);

    await waitFor(() => {
      expect(window.location.pathname).toContain("/novels/kakuyomu%3A");
    });
  });

  it("カスタム onSelectNovel 存在時に作品の自動追加が失敗した場合は onSelectNovel が呼ばれないこと", async () => {
    const user = userEvent.setup();
    const handleSelectNovel = vi.fn();

    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("作品取得エラー");
    });

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    const input = screen.getByTestId("search-input");
    await user.type(input, "異世界{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("search-results-list")).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId(/^search-novel-card-/);
    await user.click(cards[0]);

    expect(handleSelectNovel).not.toHaveBeenCalled();
  });
});
