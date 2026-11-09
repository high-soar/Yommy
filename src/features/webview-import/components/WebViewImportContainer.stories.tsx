import type { Meta, StoryObj } from "@storybook/react";
import { WebViewImportContainer } from "./WebViewImportContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { MockWebViewDomBridge } from "../../../bridges/webview/mockWebViewDomBridge";

const mockBridge = new MockWebViewDomBridge();

const meta: Meta<typeof WebViewImportContainer> = {
  title: "Features/WebViewImport/WebViewImportContainer",
  component: WebViewImportContainer,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <ServiceProvider services={{ webViewDomBridge: mockBridge }}>
        <RouterProvider initialPath="/browser">
          <Story />
        </RouterProvider>
      </ServiceProvider>
    ),
  ],
  args: {
    initialUrl: "https://kakuyomu.jp/works/16817330658027210412",
    novelId: "kakuyomu:16817330658027210412",
  },
};

export default meta;
type Story = StoryObj<typeof WebViewImportContainer>;

/** 通常表示（対応作品URL） */
export const Default: Story = {
  name: "通常表示",
};

/** 非対応URL表示時 */
export const UnsupportedUrl: Story = {
  name: "非対応URL表示",
  args: {
    initialUrl: "https://example.com/unsupported",
  },
};

/** 読み込み中状態 */
export const Loading: Story = {
  name: "読み込み中",
  args: {
    initialUrl: "https://kakuyomu.jp/works/loading",
  },
};
