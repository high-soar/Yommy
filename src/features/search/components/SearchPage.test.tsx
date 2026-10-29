import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchPage.stories";
import { SearchPage } from "./SearchPage";
import { sampleSearchItem } from "./SearchNovelCard.stories";

const { Initial, Loading, Empty, WithResults, LoadingMore, ErrorState } =
  composeStories(stories);

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
});
