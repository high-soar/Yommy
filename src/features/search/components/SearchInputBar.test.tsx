import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SearchInputBar.stories";
import { SearchInputBar } from "./SearchInputBar";

const { Empty, WithKeyword, Loading } = composeStories(stories);

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
});
