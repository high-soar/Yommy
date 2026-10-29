import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchNovelCard.stories";
import { SearchNovelCard } from "./SearchNovelCard";

const { Default, Adding, Registered, WithoutLastPublished } =
  composeStories(stories);

describe("SearchNovelCard コンポーネント", () => {
  it("Default ストーリー: 作品メタデータと「＋ 本棚に追加」ボタンが描画されること", () => {
    render(<Default />);

    expect(
      screen.getByTestId("search-novel-card-16817330658027210412"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("search-card-title")).toHaveTextContent(
      "境界迷宮と異界の魔術師",
    );
    expect(screen.getByTestId("search-card-author")).toHaveTextContent(
      "小野崎",
    );
    expect(screen.getByTestId("search-card-genre")).toHaveTextContent(
      "異世界ファンタジー",
    );
    expect(screen.getByTestId("search-card-serial-status")).toHaveTextContent(
      "連載中",
    );
    expect(screen.getByTestId("search-card-synopsis")).toHaveTextContent(
      "異世界転生した主人公が古代迷宮を攻略する王道ファンタジー。",
    );
    expect(screen.getByTestId("search-card-episodes")).toHaveTextContent(
      "45話",
    );
    expect(screen.getByTestId("search-card-characters")).toHaveTextContent(
      "152,000文字",
    );
    expect(screen.getByTestId("search-card-review-points")).toHaveTextContent(
      "★ 1,250",
    );
    expect(screen.getByTestId("search-card-tags")).toHaveTextContent("異世界");
    expect(
      screen.getByTestId("search-card-last-published"),
    ).toBeInTheDocument();

    const addButton = screen.getByTestId("search-card-add-button");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();
    expect(addButton).toHaveTextContent("＋ 本棚に追加");
  });

  it("Adding ストーリー: 追加中表示となりボタンが非活性となること", () => {
    render(<Adding />);

    const addButton = screen.getByTestId("search-card-add-button");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveTextContent("追加中...");
  });

  it("Registered ストーリー: 登録済み表示となりボタンが非活性となること", () => {
    render(<Registered />);

    const regButton = screen.getByTestId("search-card-registered-button");
    expect(regButton).toBeInTheDocument();
    expect(regButton).toBeDisabled();
    expect(regButton).toHaveTextContent("✓ 登録済み");
  });

  it("WithoutLastPublished ストーリー: 最終公開日・タグがない場合も正常に描画されること", () => {
    render(<WithoutLastPublished />);

    expect(
      screen.queryByTestId("search-card-last-published"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("search-card-tags")).not.toBeInTheDocument();
  });

  it("「＋ 本棚に追加」ボタン押下時に onAdd のみが呼ばれ、onSelect は呼ばれないこと（イベント伝播停止）", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();
    const handleSelect = vi.fn();

    render(
      <SearchNovelCard
        item={stories.sampleSearchItem}
        isRegistered={false}
        isAdding={false}
        onAdd={handleAdd}
        onSelect={handleSelect}
      />,
    );

    const addButton = screen.getByTestId("search-card-add-button");
    await user.click(addButton);

    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("カード本体タップ時に onSelect が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();
    const handleSelect = vi.fn();

    render(
      <SearchNovelCard
        item={stories.sampleSearchItem}
        isRegistered={false}
        isAdding={false}
        onAdd={handleAdd}
        onSelect={handleSelect}
      />,
    );

    const card = screen.getByTestId("search-novel-card-16817330658027210412");
    await user.click(card);

    expect(handleSelect).toHaveBeenCalledTimes(1);
  });

  it("キーボード操作（Enter / Space）でカード本体の onSelect が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <SearchNovelCard
        item={stories.sampleSearchItem}
        isRegistered={false}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={handleSelect}
      />,
    );

    const card = screen.getByTestId("search-novel-card-16817330658027210412");
    card.focus();
    await user.keyboard("{Enter}");
    expect(handleSelect).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(handleSelect).toHaveBeenCalledTimes(2);
  });
});
