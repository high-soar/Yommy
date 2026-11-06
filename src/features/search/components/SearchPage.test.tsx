import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchPage.stories";
import { SearchPage } from "./SearchPage";
import { sampleSearchItem } from "../types";
import * as siteSelectorModule from "./SiteSelector";
import * as searchFilterBarModule from "./SearchFilterBar";
import * as searchInputBarModule from "./SearchInputBar";

const {
  Initial,
  Loading,
  LoadingWithItems,
  Empty,
  WithResults,
  LoadingMore,
  ErrorState,
  NarouSelected,
} = composeStories(stories);

describe("SearchPage コンポーネント", () => {
  it("Initial ストーリー: 未検索の初期案内UIが表示されること", () => {
    render(<Initial />);

    expect(screen.getByTestId("search-page")).toBeInTheDocument();
    expect(screen.getByTestId("site-selector-kakuyomu")).toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("search-filter-bar")).toBeInTheDocument();
    expect(screen.getByTestId("search-initial-state")).toBeInTheDocument();
    expect(screen.getByTestId("search-initial-state")).toHaveTextContent(
      "キーワードを入力して小説を検索",
    );
  });

  it("Loading ストーリー: 検索中のローディングUIが表示されること", () => {
    render(<Loading />);

    expect(screen.getByTestId("search-loading")).toBeInTheDocument();
    expect(
      screen.queryByTestId("search-initial-state"),
    ).not.toBeInTheDocument();
  });

  it("LoadingWithItems ストーリー: 既存データが存在してもローディングが最優先で置換表示され、旧一覧が非表示となること (AC-SE-09)", () => {
    render(<LoadingWithItems />);

    expect(screen.getByTestId("search-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("search-results-list")).not.toBeInTheDocument();

    // 検索ボタン・フィルタバー・サイトセレクタが無効化されていること
    expect(screen.getByTestId("search-submit-button")).toBeDisabled();
    expect(screen.getByTestId("search-order-select")).toBeDisabled();
    expect(screen.getByTestId("search-serial-all")).toBeDisabled();
    expect(screen.getByTestId("search-genre-all")).toBeDisabled();
    expect(screen.getByTestId("site-selector-kakuyomu")).toBeDisabled();

    // テキスト入力欄は入力可能（enabled）を維持していること
    expect(screen.getByTestId("search-input")).toBeEnabled();
  });

  it("Empty ストーリー: 検索結果0件の空状態UIが表示されること", () => {
    render(<Empty />);

    expect(screen.getByTestId("search-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("search-empty-state")).toHaveTextContent(
      "作品が見つかりませんでした",
    );
  });

  it("WithResults ストーリー: 検索結果カード一覧と「さらに読み込む」ボタンが表示されること", () => {
    render(<WithResults />);

    const list = screen.getByTestId("search-results-list");
    expect(list).toBeInTheDocument();

    expect(
      screen.getByTestId("search-novel-card-16817330658027210412"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("search-novel-card-1177354054881162325"),
    ).toBeInTheDocument();

    const loadMoreBtn = screen.getByTestId("search-load-more-button");
    expect(loadMoreBtn).toBeInTheDocument();
    expect(loadMoreBtn).toBeEnabled();
    expect(loadMoreBtn).toHaveTextContent("さらに読み込む");
  });

  it("LoadingMore ストーリー: 「さらに読み込む」ボタンがローディング表示かつ非活性であること", () => {
    render(<LoadingMore />);

    const loadMoreBtn = screen.getByTestId("search-load-more-button");
    expect(loadMoreBtn).toBeInTheDocument();
    expect(loadMoreBtn).toBeDisabled();
    expect(loadMoreBtn).toHaveTextContent("読み込み中...");
  });

  it("ErrorState ストーリー: エラー表示と再試行ボタンが表示されること", () => {
    render(<ErrorState />);

    const errorBox = screen.getByTestId("search-error");
    expect(errorBox).toBeInTheDocument();
    expect(errorBox).toHaveTextContent("検索結果の取得に失敗しました");

    const retryButton = screen.getByTestId("search-error-retry-button");
    expect(retryButton).toBeInTheDocument();
  });

  it("NarouSelected ストーリー: なろう選択時に小ジャンルピルが表示されること (AC-SE-10)", () => {
    render(<NarouSelected />);

    expect(screen.getByTestId("site-selector-narou")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("search-genre-201")).toBeInTheDocument();
  });

  it("再試行ボタン押下時に onRetry が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();

    render(
      <SearchPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
        keyword="エラー"
        onChangeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        isLoadingMore={false}
        hasNextPage={false}
        onLoadMore={vi.fn()}
        error="ネットワークエラー"
        onRetry={handleRetry}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
      />,
    );

    const retryBtn = screen.getByTestId("search-error-retry-button");
    await user.click(retryBtn);

    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("hasSearched が false の場合、keyword が入力されていても初期状態案内が表示されること", () => {
    render(
      <SearchPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
        keyword="異世界ファンタジー"
        onChangeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        isLoadingMore={false}
        hasNextPage={false}
        onLoadMore={vi.fn()}
        error={null}
        onRetry={vi.fn()}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
        hasSearched={false}
      />,
    );

    expect(screen.getByTestId("search-initial-state")).toBeInTheDocument();
    expect(screen.queryByTestId("search-empty-state")).not.toBeInTheDocument();
  });

  it("さらに読み込むボタン押下時に onLoadMore が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleLoadMore = vi.fn();

    render(
      <SearchPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
        keyword="異世界"
        onChangeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[sampleSearchItem]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        isLoadingMore={false}
        hasNextPage={true}
        onLoadMore={handleLoadMore}
        error={null}
        onRetry={vi.fn()}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
      />,
    );

    const loadMoreBtn = screen.getByTestId("search-load-more-button");
    await user.click(loadMoreBtn);

    expect(handleLoadMore).toHaveBeenCalledTimes(1);
  });

  it("エラー発生時は items が存在していてもエラーカードのみが表示され、作品一覧が非表示となること (AC-SE-09)", () => {
    render(
      <SearchPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
        keyword="異世界"
        onChangeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[sampleSearchItem]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        isLoadingMore={false}
        hasNextPage={false}
        onLoadMore={vi.fn()}
        error="通信エラーが発生しました"
        onRetry={vi.fn()}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
        hasSearched={true}
      />,
    );

    expect(screen.getByTestId("search-error")).toBeInTheDocument();
    expect(screen.queryByTestId("search-results-list")).not.toBeInTheDocument();
  });

  it("親子分離: selectedSite が SiteSelector および SearchFilterBar へ正しく伝播すること (AC-SE-10)", () => {
    const siteSelectorSpy = vi.spyOn(siteSelectorModule, "SiteSelector");
    const filterBarSpy = vi.spyOn(searchFilterBarModule, "SearchFilterBar");

    render(
      <SearchPage
        selectedSite="narou"
        onSelectSite={vi.fn()}
        keyword=""
        onChangeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        isLoadingMore={false}
        hasNextPage={false}
        onLoadMore={vi.fn()}
        error={null}
        onRetry={vi.fn()}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
      />,
    );

    expect(siteSelectorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ selectedSite: "narou" }),
      undefined,
    );
    expect(filterBarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ selectedSite: "narou" }),
      undefined,
    );

    siteSelectorSpy.mockRestore();
    filterBarSpy.mockRestore();
  });

  it("isLoadingMore が true の場合、SiteSelector, SearchInputBar, SearchFilterBar が非活性化されること (R1-01)", () => {
    const siteSelectorSpy = vi.spyOn(siteSelectorModule, "SiteSelector");
    const inputBarSpy = vi.spyOn(searchInputBarModule, "SearchInputBar");
    const filterBarSpy = vi.spyOn(searchFilterBarModule, "SearchFilterBar");

    render(
      <SearchPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
        keyword="異世界"
        onChangeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        isLoadingMore={true}
        hasNextPage={true}
        onLoadMore={vi.fn()}
        error={null}
        onRetry={vi.fn()}
        onAddNovel={vi.fn()}
        onSelectCard={vi.fn()}
      />,
    );

    expect(siteSelectorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true }),
      undefined,
    );
    expect(inputBarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ isLoading: true }),
      undefined,
    );
    expect(filterBarSpy).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true }),
      undefined,
    );

    siteSelectorSpy.mockRestore();
    inputBarSpy.mockRestore();
    filterBarSpy.mockRestore();
  });

  it("カード本体および本棚に追加ボタンを押下した際、onSelectCard および onAddNovel が正しく呼び出されること", async () => {
    const user = userEvent.setup();
    const handleAddNovel = vi.fn();
    const handleSelectCard = vi.fn();

    render(
      <SearchPage
        selectedSite="kakuyomu"
        onSelectSite={vi.fn()}
        keyword="異世界"
        onChangeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
        selectedOrder="weekly_ranking"
        onSelectOrder={vi.fn()}
        selectedSerialStatus="all"
        onSelectSerialStatus={vi.fn()}
        selectedGenre={undefined}
        onSelectGenre={vi.fn()}
        items={[sampleSearchItem]}
        registeredWorkIds={new Set()}
        addingWorkId={null}
        isLoading={false}
        isLoadingMore={false}
        hasNextPage={false}
        onLoadMore={vi.fn()}
        error={null}
        onRetry={vi.fn()}
        onAddNovel={handleAddNovel}
        onSelectCard={handleSelectCard}
        hasSearched={true}
      />,
    );

    const card = screen.getByTestId(
      `search-novel-card-${sampleSearchItem.remoteWorkId}`,
    );
    await user.click(card);
    expect(handleSelectCard).toHaveBeenCalledWith(sampleSearchItem);

    const addBtn = screen.getByTestId("search-card-add-button");
    await user.click(addBtn);
    expect(handleAddNovel).toHaveBeenCalledWith(sampleSearchItem);
  });
});
