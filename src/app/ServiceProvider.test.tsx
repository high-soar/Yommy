import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ServiceProvider.stories";
import {
  ServiceProvider,
  useServices,
  getStoredDatabaseBinary,
  persistDatabaseBinary,
} from "./ServiceProvider";
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

    it("localStorage のデータが破損している場合は初期化エラーにならず新規初期化されること", async () => {
      localStorage.setItem("yommy_sqlite_db_backup", "invalid-base64!!!");
      render(
        <ServiceProvider>
          <div>破損データ復旧テスト</div>
        </ServiceProvider>,
      );
      await waitFor(() => {
        expect(screen.getByText("破損データ復旧テスト")).toBeInTheDocument();
      });
    });

    it("localStorage 保存時に例外が発生してもクラッシュせず無視されること", async () => {
      const setItemSpy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("QuotaExceededError");
        });

      const TestConsumer: React.FC = () => {
        const services = useServices();
        return (
          <button
            onClick={async () => {
              await services.databaseAdapter.execute(
                "CREATE TABLE IF NOT EXISTS test_quota (id INT);",
              );
            }}
          >
            更新
          </button>
        );
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("更新")).toBeInTheDocument();
      });
      screen.getByText("更新").click();

      setItemSpy.mockRestore();
    });

    it("createDefaultMockHttpClient の正規表現ルートで各話エピソードが取得できること", async () => {
      let content = "";
      const TestConsumer: React.FC = () => {
        const services = useServices();
        React.useEffect(() => {
          if (services.isReady) {
            services.httpClient
              .getHtml({
                url: "https://kakuyomu.jp/works/1177354054881162325/episodes/999999",
              })
              .then((res) => {
                content = res.html;
              });
          }
        }, [services]);
        return <div>モックHTTPテスト</div>;
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(content).toContain("第1話 見知らぬ空");
      });
    });

    it("カスタム databaseAdapter および 各 Repository が渡された場合にそのまま利用されること", async () => {
      const customDb = {
        execute: vi.fn(),
        query: vi.fn().mockResolvedValue([]),
        runTransaction: vi.fn((cb) => cb()),
        close: vi.fn(),
      } as unknown as import("../storage/adapter/types").DatabaseAdapter;
      const customNovelRepo = {
        listNovels: vi.fn().mockResolvedValue([]),
      } as unknown as import("../storage/types").NovelRepository;
      const customChapterRepo = {
        getChapter: vi.fn().mockResolvedValue(null),
      } as unknown as import("../storage/types").ChapterRepository;
      const customSettingsRepo = {
        getReaderSettings: vi.fn().mockResolvedValue({}),
      } as unknown as import("../storage/types").SettingsRepository;

      render(
        <ServiceProvider
          services={{
            databaseAdapter: customDb,
            novelRepository: customNovelRepo,
            chapterRepository: customChapterRepo,
            settingsRepository: customSettingsRepo,
          }}
        >
          <div>カスタムサービス注入</div>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("カスタムサービス注入")).toBeInTheDocument();
      });
    });

    it("fallback なしで初期化中の場合は未完了時の children がレンダリングされること", async () => {
      render(
        <ServiceProvider>
          <div>初期化中子コンポーネント</div>
        </ServiceProvider>,
      );
      expect(screen.getByText("初期化中子コンポーネント")).toBeInTheDocument();
      await waitFor(() => {
        expect(
          screen.getByText("初期化中子コンポーネント"),
        ).toBeInTheDocument();
      });
    });

    it("storage が利用できない環境（null）での getStoredDatabaseBinary と persistDatabaseBinary の安全なフォールバック", () => {
      expect(getStoredDatabaseBinary(null)).toBeUndefined();
      expect(() =>
        persistDatabaseBinary(new Uint8Array([1, 2, 3]), null),
      ).not.toThrow();
    });
  });
});
