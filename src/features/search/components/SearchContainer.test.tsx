import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchContainer.stories";
import { SearchContainer } from "./SearchContainer";
import * as SearchPageModule from "./SearchPage";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import { MockHttpClient } from "../../../bridges/http/mockHttpClient";
import searchApolloHtml from "../../../parsers/kakuyomu/__fixtures__/search_results_apollo.html?raw";
import workIndexHtml from "../../../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import narouSearchResultsJson from "../../../parsers/narou/__fixtures__/search_results.json?raw";

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
    mockHttpClient.setResponse(
      /^https:\/\/api\.syosetu\.com\/novelapi\/api\//,
      (options) => ({
        status: 200,
        url: options.url,
        headers: {},
        html: narouSearchResultsJson,
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

  it("Default ストーリー: 検索画面の初期未検索状態がレンダリングされ、子コンポーネント（SearchPage）に初期Propsが正しく伝搬されること (R1-21)", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    render(<Default />);

    await waitFor(() => {
      expect(screen.getByTestId("search-page")).toBeInTheDocument();
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedSite: "kakuyomu",
          keyword: "",
          selectedOrder: "weekly_ranking",
          selectedSerialStatus: "all",
          selectedGenre: undefined,
          isLoading: false,
          items: [],
        }),
        undefined,
      );
    });
    expect(screen.getByTestId("search-initial-state")).toBeInTheDocument();
    pageSpy.mockRestore();
  });

  it("検索実行前に入力欄へキーワードを入力しても初期状態表示が維持されること", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: "",
          hasSearched: false,
        }),
        undefined,
      );
    });

    const lastCallProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastCallProps.onChangeKeyword("異世界");
    });

    await waitFor(() => {
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          keyword: "異世界",
          hasSearched: false,
        }),
        undefined,
      );
    });

    pageSpy.mockRestore();
  });

  it("キーワードを入力して検索を実行し、カード一覧が表示されること (AC-SE-02)", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalled();
    });

    const lastCallProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastCallProps.onChangeKeyword("異世界");
      lastCallProps.onSubmitSearch();
    });

    await waitFor(() => {
      const currentProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(currentProps.items.length).toBeGreaterThan(0);
      expect(currentProps.hasSearched).toBe(true);
    });

    pageSpy.mockRestore();
  });

  it("カードの onAddNovel 呼び出しで本棚に登録され registeredWorkIds に追加されること (AC-SE-06)", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalled();
    });

    let lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastProps.onChangeKeyword("異世界");
      lastProps.onSubmitSearch();
    });

    await waitFor(() => {
      lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const targetItem = lastProps.items[0];

    act(() => {
      lastProps.onAddNovel(targetItem);
    });

    await waitFor(() => {
      const currentProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(currentProps.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
        true,
      );
    });

    pageSpy.mockRestore();
  });

  it("カスタム onSelectNovel が提供されている場合、未登録カードの onSelectCard 呼び出しで本棚追加の上で onSelectNovel が呼ばれること", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalled();
    });

    let lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastProps.onChangeKeyword("異世界");
      lastProps.onSubmitSearch();
    });

    await waitFor(() => {
      lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const targetItem = lastProps.items[0];

    act(() => {
      lastProps.onSelectCard(targetItem);
    });

    await waitFor(() => {
      expect(handleSelectNovel).toHaveBeenCalled();
    });

    pageSpy.mockRestore();
  });

  it("登録済み作品カードをカスタム onSelectNovel 存在時に onSelectCard 呼び出しすると直接コールバックが呼ばれること", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    const handleSelectNovel = vi.fn();

    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalled();
    });

    let lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastProps.onChangeKeyword("異世界");
      lastProps.onSubmitSearch();
    });

    await waitFor(() => {
      lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const targetItem = lastProps.items[0];

    // まず本棚に追加して登録済みにする
    act(() => {
      lastProps.onAddNovel(targetItem);
    });

    await waitFor(() => {
      const currentProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(currentProps.registeredWorkIds.has(targetItem.remoteWorkId)).toBe(
        true,
      );
    });

    // 登録済み状態でカードタップ
    lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastProps.onSelectCard(targetItem);
    });

    expect(handleSelectNovel).toHaveBeenCalledWith(
      expect.stringContaining("kakuyomu:"),
    );

    pageSpy.mockRestore();
  });

  it("カスタム onSelectNovel が未指定（デフォルト）の場合、カードの onSelectCard 呼び出しで router の詳細画面へ遷移すること", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalled();
    });

    let lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastProps.onChangeKeyword("異世界");
      lastProps.onSubmitSearch();
    });

    await waitFor(() => {
      lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const targetItem = lastProps.items[0];

    act(() => {
      lastProps.onSelectCard(targetItem);
    });

    await waitFor(() => {
      expect(window.location.pathname).toContain("/novels/kakuyomu%3A");
    });

    pageSpy.mockRestore();
  });

  it("カスタム onSelectNovel 存在時に作品の自動追加が失敗した場合は onSelectNovel が呼ばれないこと", async () => {
    const handleSelectNovel = vi.fn();

    mockHttpClient.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, () => {
      throw new Error("作品取得エラー");
    });

    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    renderWithProviders({ onSelectNovel: handleSelectNovel });

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalled();
    });

    let lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastProps.onChangeKeyword("異世界");
      lastProps.onSubmitSearch();
    });

    await waitFor(() => {
      lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(lastProps.items.length).toBeGreaterThan(0);
    });

    const targetItem = lastProps.items[0];

    act(() => {
      lastProps.onSelectCard(targetItem);
    });

    await waitFor(() => {
      const currentProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
      expect(currentProps.error).not.toBeNull();
    });

    expect(handleSelectNovel).not.toHaveBeenCalled();
    pageSpy.mockRestore();
  });

  it("SiteSelector によるサイト切替コールバック（onSelectSite）呼び出し時に、子コンポーネント（SearchPage）へ selectedSite が伝搬すること (AC-SE-10, R1-21)", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedSite: "kakuyomu",
          isLoading: false,
        }),
        undefined,
      );
    });

    const lastCallProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    act(() => {
      lastCallProps.onSelectSite("narou");
    });

    await waitFor(() => {
      expect(pageSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          selectedSite: "narou",
        }),
        undefined,
      );
    });

    pageSpy.mockRestore();
  });

  it("SearchPage に excludeKeyword, onChangeExcludeKeyword, selectedGenres が正しくバインドされること (v0.8 Issue #264)", async () => {
    const pageSpy = vi.spyOn(SearchPageModule, "SearchPage");
    renderWithProviders();

    await waitFor(() => {
      expect(pageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeKeyword: "",
          onChangeExcludeKeyword: expect.any(Function),
          selectedGenres: [],
        }),
        undefined,
      );
    });

    pageSpy.mockRestore();
  });
});
