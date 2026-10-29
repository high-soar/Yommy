import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./RankingNovelCard.stories";
import { RankingNovelCard } from "./RankingNovelCard";
import { sampleRankingItem1 } from "../types";

const {
  Rank1Gold,
  Rank2Silver,
  Rank3Bronze,
  Rank4Standard,
  Adding,
  Registered,
  WithoutLastPublished,
} = composeStories(stories);

describe("RankingNovelCard コンポーネント", () => {
  it("Rank1Gold ストーリー: 1位のゴールドバッジおよび全作品メタデータが描画されること (AC-RK-04, AC-RK-05)", () => {
    render(<Rank1Gold />);

    expect(
      screen.getByTestId("ranking-novel-card-16817330658027210412"),
    ).toBeInTheDocument();

    const rankBadge = screen.getByTestId("ranking-card-rank-badge");
    expect(rankBadge).toHaveTextContent("1位");

    expect(screen.getByTestId("ranking-card-title")).toHaveTextContent(
      "境界迷宮と異界の魔術師",
    );
    expect(screen.getByTestId("ranking-card-author")).toHaveTextContent(
      "小野崎",
    );
    expect(screen.getByTestId("ranking-card-genre")).toHaveTextContent(
      "異世界ファンタジー",
    );
    expect(screen.getByTestId("ranking-card-serial-status")).toHaveTextContent(
      "連載中",
    );
    expect(screen.getByTestId("ranking-card-synopsis")).toHaveTextContent(
      "異世界転生した主人公が古代迷宮を攻略する王道ファンタジー。",
    );
    expect(screen.getByTestId("ranking-card-episodes")).toHaveTextContent(
      "45話",
    );
    expect(screen.getByTestId("ranking-card-characters")).toHaveTextContent(
      "152,000文字",
    );
    expect(screen.getByTestId("ranking-card-review-points")).toHaveTextContent(
      "★ 12,500",
    );
    expect(screen.getByTestId("ranking-card-tags")).toHaveTextContent("異世界");
    expect(
      screen.getByTestId("ranking-card-last-published"),
    ).toBeInTheDocument();

    const addButton = screen.getByTestId("ranking-card-add-button");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();
    expect(addButton).toHaveTextContent("＋ 本棚に追加");
  });

  it("Rank2Silver ストーリー: 2位のシルバーバッジが描画されること (AC-RK-04)", () => {
    render(<Rank2Silver />);

    const rankBadge = screen.getByTestId("ranking-card-rank-badge");
    expect(rankBadge).toHaveTextContent("2位");
  });

  it("Rank3Bronze ストーリー: 3位のブロンズバッジが描画されること (AC-RK-04)", () => {
    render(<Rank3Bronze />);

    const rankBadge = screen.getByTestId("ranking-card-rank-badge");
    expect(rankBadge).toHaveTextContent("3位");
  });

  it("Rank4Standard ストーリー: 4位以降の通常バッジが描画されること (AC-RK-04)", () => {
    render(<Rank4Standard />);

    const rankBadge = screen.getByTestId("ranking-card-rank-badge");
    expect(rankBadge).toHaveTextContent("4位");
  });

  it("Adding ストーリー: 追加中表示となりボタンが非活性となること (AC-RK-06)", () => {
    render(<Adding />);

    const addButton = screen.getByTestId("ranking-card-add-button");
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveTextContent("追加中...");
  });

  it("Registered ストーリー: 登録済み表示となりボタンが非活性となること (AC-RK-06)", () => {
    render(<Registered />);

    const regButton = screen.getByTestId("ranking-card-registered-button");
    expect(regButton).toBeInTheDocument();
    expect(regButton).toBeDisabled();
    expect(regButton).toHaveTextContent("✓ 登録済み");
  });

  it("WithoutLastPublished ストーリー: 最終公開日・タグがない場合も正常に描画されること", () => {
    render(<WithoutLastPublished />);

    expect(
      screen.queryByTestId("ranking-card-last-published"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("ranking-card-tags")).not.toBeInTheDocument();
  });

  it("「＋ 本棚に追加」ボタン押下時に onAdd のみが呼ばれ、onSelect は呼ばれないこと（イベント伝播停止） (AC-RK-06)", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();
    const handleSelect = vi.fn();

    render(
      <RankingNovelCard
        item={sampleRankingItem1}
        isRegistered={false}
        isAdding={false}
        onAdd={handleAdd}
        onSelect={handleSelect}
      />,
    );

    const addButton = screen.getByTestId("ranking-card-add-button");
    await user.click(addButton);

    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("カード本体タップ時に onSelect が呼び出されること (AC-RK-07)", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();
    const handleSelect = vi.fn();

    render(
      <RankingNovelCard
        item={sampleRankingItem1}
        isRegistered={false}
        isAdding={false}
        onAdd={handleAdd}
        onSelect={handleSelect}
      />,
    );

    const card = screen.getByTestId("ranking-novel-card-16817330658027210412");
    await user.click(card);

    expect(handleSelect).toHaveBeenCalledTimes(1);
  });

  it("キーボード操作（Enter / Space）でカード本体の onSelect が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <RankingNovelCard
        item={sampleRankingItem1}
        isRegistered={false}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={handleSelect}
      />,
    );

    const card = screen.getByTestId("ranking-novel-card-16817330658027210412");
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
      <RankingNovelCard
        item={sampleRankingItem1}
        isRegistered={false}
        isAdding={false}
        onAdd={handleAdd}
        onSelect={handleSelect}
      />,
    );

    const addButton = screen.getByTestId("ranking-card-add-button");
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
      <RankingNovelCard
        item={{
          ...sampleRankingItem1,
          genreLabel: "",
        }}
        isRegistered={false}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("ranking-card-genre")).toHaveTextContent(
      "fantasy",
    );
  });

  it("synopsis が空の場合はあらすじ要素が描画されないこと", () => {
    render(
      <RankingNovelCard
        item={{
          ...sampleRankingItem1,
          synopsis: "",
        }}
        isRegistered={false}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("ranking-card-synopsis"),
    ).not.toBeInTheDocument();
  });

  it("アクションラッパー内部をクリックしても親カードの onSelect が発火しないこと", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <RankingNovelCard
        item={sampleRankingItem1}
        isRegistered={true}
        isAdding={false}
        onAdd={vi.fn()}
        onSelect={handleSelect}
      />,
    );

    const actionWrapper = screen.getByTestId("ranking-card-action-wrapper");
    await user.click(actionWrapper);

    expect(handleSelect).not.toHaveBeenCalled();
  });
});
