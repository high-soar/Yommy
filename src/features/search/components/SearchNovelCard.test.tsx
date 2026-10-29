import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchNovelCard.stories";
import { SearchNovelCard } from "./SearchNovelCard";
import { sampleSearchItem } from "../types";

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
        item={sampleSearchItem}
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
        item={sampleSearchItem}
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
        item={sampleSearchItem}
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

    await user.keyboard("{Escape}");
    expect(handleSelect).toHaveBeenCalledTimes(2);
  });

  it("キーボード操作（Enter / Space）で「＋ 本棚に追加」ボタンを押下した際、カードの onSelect が発火せず onAdd のみ呼ばれること", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();
    const handleSelect = vi.fn();

    render(
      <SearchNovelCard
        item={sampleSearchItem}
        isRegistered={false}
        isAdding={false}
        onAdd={handleAdd}
        onSelect={handleSelect}
      />,
    );

    const addButton = screen.getByTestId("search-card-add-button");
    addButton.focus();
    await user.keyboard("{Enter}");
    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleSelect).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(handleAdd).toHaveBeenCalledTimes(2);
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("genreLabel が空の場合は genre がフォールバック表示されること", () => {
    render(
      <SearchNovelCard
        item={{
          ...sampleSearchItem,
          genreLabel: "",
          genre: "fantasy_raw",
        }}
        isRegistered={false}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("search-card-genre")).toHaveTextContent(
      "fantasy_raw",
    );
  });

  it("serialStatus が completed の場合に完結バッジのスタイルが適用されること", () => {
    render(
      <SearchNovelCard
        item={{
          ...sampleSearchItem,
          serialStatus: "completed",
          serialStatusLabel: "完結済",
        }}
        isRegistered={false}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const statusBadge = screen.getByTestId("search-card-serial-status");
    expect(statusBadge).toHaveTextContent("完結済");
    expect(statusBadge.className).toContain("text-emerald-700");
  });

  it("子要素（タイトル等）からのキーダウンイベント（target !== currentTarget）では onSelect が発火しないこと", () => {
    const handleSelect = vi.fn();
    render(
      <SearchNovelCard
        item={sampleSearchItem}
        isRegistered={false}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={handleSelect}
      />,
    );

    const title = screen.getByTestId("search-card-title");
    fireEvent.keyDown(title, { key: "Enter" });
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("登録済みボタンの親ラッパーをクリックしてもカード本体の onSelect は発火しないこと（stopPropagation）", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <SearchNovelCard
        item={sampleSearchItem}
        isRegistered={true}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={handleSelect}
      />,
    );

    const actionWrapper = screen.getByTestId("search-card-action-wrapper");
    await user.click(actionWrapper);

    expect(handleSelect).not.toHaveBeenCalled();
  });
});
