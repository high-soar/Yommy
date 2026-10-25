import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ServiceProvider.stories";
import { ServiceProvider, useServices } from "./ServiceProvider";
import { resetTestDb } from "../storage/adapter/inMemoryDb";

const { Default, CustomMockServices } = composeStories(stories);

describe("ServiceProvider", () => {
  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーが正常に描画されサービスが初期化されること", async () => {
      render(<Default />);
      await waitFor(() => {
        expect(screen.getByTestId("service-ready")).toHaveTextContent("yes");
      });
      expect(screen.getByTestId("service-http")).toHaveTextContent("present");
      expect(screen.getByTestId("service-parser")).toHaveTextContent("present");
      expect(screen.getByTestId("service-db")).toHaveTextContent("present");
      expect(screen.getByTestId("service-novel-repo")).toHaveTextContent(
        "present",
      );
    });

    it("CustomMockServices ストーリーでカスタムモックが反映されること", async () => {
      render(<CustomMockServices />);
      await waitFor(() => {
        expect(screen.getByTestId("service-ready")).toHaveTextContent("yes");
      });
      expect(screen.getByTestId("service-http")).toHaveTextContent("present");
    });
  });

  describe("フックと Provider 境界値・例外検証", () => {
    it("ServiceProvider 外で useServices を呼び出した場合にエラーがスローされること", () => {
      const BadConsumer: React.FC = () => {
        useServices();
        return null;
      };

      // コンソールエラーの出力を抑制
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<BadConsumer />)).toThrow(
        "useServices must be used within a ServiceProvider",
      );
      spy.mockRestore();
    });

    it("DB 更新時に localStorage へのエクスポート・バックアップが行われること", async () => {
      const TestConsumer: React.FC = () => {
        const services = useServices();
        return (
          <button
            onClick={async () => {
              await services.databaseAdapter.execute(
                "CREATE TABLE IF NOT EXISTS test_persist (id INT);",
              );
            }}
          >
            DB更新
          </button>
        );
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("DB更新")).toBeInTheDocument();
      });

      screen.getByText("DB更新").click();

      await waitFor(() => {
        expect(localStorage.getItem("yommy_sqlite_db_backup")).toBeTruthy();
      });
    });

    it("localStorage に保存されたバックアップから初期化時にリストアされること", async () => {
      // 事前にデータをバックアップ
      const adapter = await resetTestDb();
      await adapter.execute(
        `INSERT INTO novels (id, site_type, remote_work_id, canonical_url, title, created_at, updated_at)
         VALUES ('restored:1', 'kakuyomu', 'r1', 'https://kakuyomu.jp/works/r1', '復元テスト作品', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`,
      );
      const binary = adapter.exportBinary();
      let binaryStr = "";
      for (let i = 0; i < binary.byteLength; i++) {
        binaryStr += String.fromCharCode(binary[i]);
      }
      localStorage.setItem("yommy_sqlite_db_backup", btoa(binaryStr));

      let restoredTitle = "";
      const TestConsumer: React.FC = () => {
        const services = useServices();
        React.useEffect(() => {
          if (services.isReady) {
            services.novelRepository.listNovels().then((novels) => {
              if (novels.length > 0) {
                restoredTitle = novels[0].title;
              }
            });
          }
        }, [services]);
        return <div>復元テスト</div>;
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(restoredTitle).toBe("復元テスト作品");
      });
    });
  });
});
