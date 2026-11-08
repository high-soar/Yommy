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

export const Default: Story = {};

export const UnsupportedUrl: Story = {
  args: {
    initialUrl: "https://example.com/unsupported",
  },
};

export const Loading: Story = {
  args: {
    initialUrl: "https://kakuyomu.jp/works/loading",
  },
};
