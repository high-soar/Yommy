import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { ServiceProvider, useServices } from "./ServiceProvider";
import type { HttpClientBridge } from "../bridges/http/types";
import { createDefaultParserRegistry } from "../parsers/parserRegistry";

const MetaComponent: React.FC = () => {
  const services = useServices();
  return (
    <div className="p-4 bg-slate-100 rounded text-sm font-mono space-y-2">
      <div data-testid="service-ready">
        Ready: {services.isReady ? "yes" : "no"}
      </div>
      <div data-testid="service-http">
        HttpClient: {services.httpClient ? "present" : "missing"}
      </div>
      <div data-testid="service-parser">
        ParserRegistry: {services.parserRegistry ? "present" : "missing"}
      </div>
      <div data-testid="service-db">
        DatabaseAdapter: {services.databaseAdapter ? "present" : "missing"}
      </div>
      <div data-testid="service-novel-repo">
        NovelRepository: {services.novelRepository ? "present" : "missing"}
      </div>
    </div>
  );
};

const meta: Meta<typeof ServiceProvider> = {
  title: "App/ServiceProvider",
  component: ServiceProvider,
};

export default meta;
type Story = StoryObj<typeof ServiceProvider>;

/**
 * デフォルトのインメモリ/モックサービス群で初期化されるストーリー
 */
export const Default: Story = {
  name: "デフォルトサービス初期化",
  render: () => (
    <ServiceProvider fallback={<div>サービス初期化中...</div>}>
      <MetaComponent />
    </ServiceProvider>
  ),
};

/**
 * 外部からモックサービスを差し替えたストーリー
 */
export const CustomMockServices: Story = {
  name: "カスタムモックサービス注入",
  render: () => {
    const mockHttp: HttpClientBridge = {
      getHtml: async () => ({
        status: 200,
        url: "https://example.com",
        html: "<html></html>",
        headers: {},
      }),
    };
    return (
      <ServiceProvider
        services={{
          httpClient: mockHttp,
          parserRegistry: createDefaultParserRegistry(),
        }}
        fallback={<div>初期化中...</div>}
      >
        <MetaComponent />
      </ServiceProvider>
    );
  },
};
