import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchInputBar.stories";
import { SearchInputBar } from "./SearchInputBar";

const {
  Empty,
  WithKeyword,
  Loading,
  WithExcludeKeywordOpen,
  WithExcludeKeywordActiveCollapsed,
} = composeStories(stories);

describe("SearchInputBar コンポーネント", () => {
  it("Empty ストーリー: 入力欄と検索ボタンが表示され、クリアボタンは非表示であること", () => {
    render(<Empty />);

    const input = screen.getByTestId("search-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute(
      "placeholder",
      "作品名・著者名・キーワードを入力",
    );
    expect(input).toHaveValue("");

    expect(screen.getByTestId("search-submit-button")).toBeInTheDocument();
    expect(screen.queryByTestId("search-clear-button")).not.toBeInTheDocument();
  });

  it("WithKeyword ストーリー: キーワードが入力され、クリアボタンが表示されること", () => {
    render(<WithKeyword />);

    const input = screen.getByTestId("search-input");
    expect(input).toHaveValue("異世界 魔法");

    const clearButton = screen.getByTestId("search-clear-button");
    expect(clearButton).toBeInTheDocument();
    expect(clearButton).toHaveAttribute("aria-label", "キーワードをクリア");
  });

  it("Loading ストーリー: isLoading が真のとき検索ボタンが無効化され、テキスト入力は入力可能を維持すること (AC-SE-09)", () => {
    render(<Loading />);

    const submitBtn = screen.getByTestId("search-submit-button");
    expect(submitBtn).toBeDisabled();

    const input = screen.getByTestId("search-input");
    expect(input).toBeEnabled();
  });

  it("キーワード入力時に onChangeKeyword が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <SearchInputBar
        keyword=""
        onChangeKeyword={handleChange}
        onSubmitSearch={handleSubmit}
      />,
    );

    const input = screen.getByTestId("search-input");
    await user.type(input, "ダンジョン");

    expect(handleChange).toHaveBeenCalled();
  });

  it("クリアボタン押下時に onChangeKeyword('') が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <SearchInputBar
        keyword="テスト"
        onChangeKeyword={handleChange}
        onSubmitSearch={handleSubmit}
      />,
    );

    const clearButton = screen.getByTestId("search-clear-button");
    await user.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("検索ボタン押下時に onSubmitSearch が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <SearchInputBar
        keyword="テスト"
        onChangeKeyword={handleChange}
        onSubmitSearch={handleSubmit}
      />,
    );

    const submitButton = screen.getByTestId("search-submit-button");
    await user.click(submitButton);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("Enter キー押下時に onSubmitSearch が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <SearchInputBar
        keyword="テスト"
        onChangeKeyword={handleChange}
        onSubmitSearch={handleSubmit}
      />,
    );

    const input = screen.getByTestId("search-input");
    await user.type(input, "{Enter}");

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("isLoading が true のとき、フォーム送信（Enterキーやボタンクリック）を試みても onSubmitSearch が呼ばれないこと (AC-SE-09)", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <SearchInputBar
        keyword="テスト"
        onChangeKeyword={vi.fn()}
        onSubmitSearch={handleSubmit}
        isLoading={true}
      />,
    );

    const submitButton = screen.getByTestId("search-submit-button");
    await user.click(submitButton);
    expect(handleSubmit).not.toHaveBeenCalled();

    const input = screen.getByTestId("search-input");
    await user.type(input, "{Enter}");
    expect(handleSubmit).not.toHaveBeenCalled();

    // フォーム直接送信時も isLoading ガードにより onSubmitSearch が呼ばれないこと
    fireEvent.submit(screen.getByRole("search"));
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("WithExcludeKeywordOpen ストーリー: 除外キーワード入力欄が展開され、入力値とクリアボタンが表示されること (v0.8 Issue #264 / AC-SE-11)", () => {
    render(<WithExcludeKeywordOpen />);

    const toggleBtn = screen.getByTestId("search-exclude-toggle-button");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    const excludeInput = screen.getByTestId("search-exclude-input");
    expect(excludeInput).toBeInTheDocument();
    expect(excludeInput).toHaveValue("ハーレム チート");

    const excludeClearBtn = screen.getByTestId("search-exclude-clear-button");
    expect(excludeClearBtn).toBeInTheDocument();
    expect(excludeClearBtn).toHaveAttribute(
      "aria-label",
      "除外キーワードをクリア",
    );
  });

  it("WithExcludeKeywordActiveCollapsed ストーリー: パネルは閉じているが除外語トグルボタンが強調表示されること (v0.8 Issue #264 / AC-SE-11)", () => {
    render(<WithExcludeKeywordActiveCollapsed />);

    const toggleBtn = screen.getByTestId("search-exclude-toggle-button");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(toggleBtn).toHaveAttribute("data-active", "true");
    expect(
      screen.queryByTestId("search-exclude-input"),
    ).not.toBeInTheDocument();
  });

  it("除外語トグルボタン押下で入力欄が開閉すること", async () => {
    const user = userEvent.setup();
    render(
      <SearchInputBar
        keyword=""
        onChangeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
      />,
    );

    const toggleBtn = screen.getByTestId("search-exclude-toggle-button");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(toggleBtn).not.toHaveAttribute("aria-controls");
    expect(
      screen.queryByTestId("search-exclude-input"),
    ).not.toBeInTheDocument();

    // クリックで展開
    await user.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    const excludeInput = screen.getByTestId("search-exclude-input");
    expect(excludeInput).toBeInTheDocument();
    expect(excludeInput.id).toBeTruthy();
    expect(toggleBtn).toHaveAttribute("aria-controls", excludeInput.id);

    // 再度クリックで折りたたみ
    await user.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(toggleBtn).not.toHaveAttribute("aria-controls");
    expect(
      screen.queryByTestId("search-exclude-input"),
    ).not.toBeInTheDocument();
  });

  it("除外キーワード入力時に onChangeExcludeKeyword が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleExcludeChange = vi.fn();

    render(
      <SearchInputBar
        keyword=""
        onChangeKeyword={vi.fn()}
        onChangeExcludeKeyword={handleExcludeChange}
        onSubmitSearch={vi.fn()}
        defaultOpenExclude={true}
      />,
    );

    const excludeInput = screen.getByTestId("search-exclude-input");
    await user.type(excludeInput, "チート");

    expect(handleExcludeChange).toHaveBeenCalled();
  });

  it("除外キーワードのクリアボタン押下時に onChangeExcludeKeyword('') が呼び出されること", async () => {
    const user = userEvent.setup();
    const handleExcludeChange = vi.fn();

    render(
      <SearchInputBar
        keyword=""
        onChangeKeyword={vi.fn()}
        excludeKeyword="ハーレム"
        onChangeExcludeKeyword={handleExcludeChange}
        onSubmitSearch={vi.fn()}
        defaultOpenExclude={true}
      />,
    );

    const clearBtn = screen.getByTestId("search-exclude-clear-button");
    await user.click(clearBtn);

    expect(handleExcludeChange).toHaveBeenCalledWith("");
  });

  it("除外キーワード入力欄で Enter キー押下時に onSubmitSearch が発火すること", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <SearchInputBar
        keyword="異世界"
        onChangeKeyword={vi.fn()}
        excludeKeyword="ハーレム"
        onChangeExcludeKeyword={vi.fn()}
        onSubmitSearch={handleSubmit}
        defaultOpenExclude={true}
      />,
    );

    const excludeInput = screen.getByTestId("search-exclude-input");
    await user.type(excludeInput, "{Enter}");

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("初期描画時に excludeKeyword が非空で渡された場合、デフォルトで展開状態となること", () => {
    render(
      <SearchInputBar
        keyword="異世界"
        onChangeKeyword={vi.fn()}
        excludeKeyword="ハーレム"
        onChangeExcludeKeyword={vi.fn()}
        onSubmitSearch={vi.fn()}
      />,
    );

    const toggleBtn = screen.getByTestId("search-exclude-toggle-button");
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("search-exclude-input")).toBeInTheDocument();
  });
});
