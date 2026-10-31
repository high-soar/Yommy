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
  createDefaultNativeSqliteAdapter,
  type ServiceContextValue,
} from "./ServiceProvider";
import type { DatabaseAdapter } from "../storage/adapter/types";
import type { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";
import { SQLiteConnection } from "@capacitor-community/sqlite";
import { resetTestDb } from "../storage/adapter/inMemoryDb";
import { CapacitorAppBridge, MockAppBridge } from "../bridges/app";
import { MockCloudSyncBridge } from "../bridges/cloud-sync/mockCloudSyncBridge";

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
      expect(screen.getByTestId("service-app-settings-repo")).toHaveTextContent(
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
      let readyState = false;
      const TestConsumer: React.FC = () => {
        const services = useServices();
        readyState = services.isReady;
        return <div>破損データ復旧テスト</div>;
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );
      expect(screen.getByText("破損データ復旧テスト")).toBeInTheDocument();
      await waitFor(() => {
        expect(readyState).toBe(true);
      });
    });

    it("localStorage 保存時に例外が発生してもクラッシュせず false を返し警告ログを出力すること", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const setItemSpy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("QuotaExceededError");
        });

      const result = persistDatabaseBinary(new Uint8Array([1, 2, 3]));
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalled();

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
      warnSpy.mockRestore();
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

    it("createDefaultMockHttpClient が任意のカクヨム作品トップURLおよびエピソードURLにマッチすること", async () => {
      let novelHtml = "";
      let episodeHtml = "";
      const TestConsumer: React.FC = () => {
        const services = useServices();
        React.useEffect(() => {
          if (services.isReady) {
            services.httpClient
              .getHtml({
                url: "https://kakuyomu.jp/works/9999999999999999999",
              })
              .then((res) => {
                novelHtml = res.html;
              });
            services.httpClient
              .getHtml({
                url: "https://kakuyomu.jp/works/9999999999999999999/episodes/123456789",
              })
              .then((res) => {
                episodeHtml = res.html;
              });
          }
        }, [services]);
        return <div>任意URLモックテスト</div>;
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(novelHtml).toContain("境界迷宮と異界の魔術師");
        expect(episodeHtml).toContain("第1話 見知らぬ空");
      });
    });

    it("createDefaultMockHttpClient がカクヨム検索URLおよびランキングURLにマッチすること", async () => {
      let searchHtml = "";
      let rankingHtml = "";
      let searchNovelHtml = "";
      let rankingNovelHtml = "";
      const TestConsumer: React.FC = () => {
        const services = useServices();
        React.useEffect(() => {
          if (services.isReady) {
            services.httpClient
              .getHtml({
                url: "https://kakuyomu.jp/search?q=%E7%95%B0%E4%B8%96%E7%95%8C",
              })
              .then((res) => {
                searchHtml = res.html;
              });
            services.httpClient
              .getHtml({
                url: "https://kakuyomu.jp/rankings/all/weekly",
              })
              .then((res) => {
                rankingHtml = res.html;
              });
            services.httpClient
              .getHtml({
                url: "https://kakuyomu.jp/works/16817330658027210001",
              })
              .then((res) => {
                searchNovelHtml = res.html;
              });
            services.httpClient
              .getHtml({
                url: "https://kakuyomu.jp/works/16817330658027210101",
              })
              .then((res) => {
                rankingNovelHtml = res.html;
              });
          }
        }, [services]);
        return <div>検索・ランキングモックテスト</div>;
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(searchHtml).toContain("転生令嬢の異世界冒険譚");
        expect(rankingHtml).toContain("ランキング1位作品：最強の剣士");
        expect(searchNovelHtml).toContain("転生令嬢の異世界冒険譚");
        expect(rankingNovelHtml).toContain("ランキング1位作品：最強の剣士");
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
      const customAppSettingsRepo = {
        getSetting: vi.fn().mockResolvedValue(null),
        setSetting: vi.fn().mockResolvedValue(undefined),
      } as unknown as import("../storage/types").AppSettingsRepository;

      render(
        <ServiceProvider
          services={{
            databaseAdapter: customDb,
            novelRepository: customNovelRepo,
            chapterRepository: customChapterRepo,
            settingsRepository: customSettingsRepo,
            appSettingsRepository: customAppSettingsRepo,
          }}
        >
          <div>カスタムサービス注入</div>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("カスタムサービス注入")).toBeInTheDocument();
      });
    });

    it("fallback なしで初期化中の場合は未完了時の children がレンダリングされ、完了後に ready: true となること", async () => {
      const TestConsumer: React.FC = () => {
        const services = useServices();
        return (
          <div data-testid="status">
            {services.isReady ? "初期化完了" : "初期化中"}
          </div>
        );
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      // 初回レンダリング時は初期化中
      expect(screen.getByTestId("status")).toHaveTextContent("初期化中");

      // 非同期初期化完了後に ready: true となること
      await waitFor(() => {
        expect(screen.getByTestId("status")).toHaveTextContent("初期化完了");
      });
    });

    it("初期化処理で例外が発生した場合に error がセットされ関数型 fallback が呼び出されること", async () => {
      const failingServices = {
        get databaseAdapter(): DatabaseAdapter {
          throw new Error("DB接続取得エラー");
        },
      };

      let capturedError: Error | null = null;
      render(
        <ServiceProvider
          services={failingServices}
          fallback={(err) => {
            capturedError = err;
            return <div data-testid="error-fallback">{err?.message}</div>;
          }}
        >
          <div>子コンテンツ</div>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-fallback")).toBeInTheDocument();
      });
      expect((capturedError as Error | null)?.message).toBe("DB接続取得エラー");
    });

    it("初期化処理で非Error例外がスローされた場合もErrorインスタンスとして正規化されること", async () => {
      const failingServices = {
        get databaseAdapter(): DatabaseAdapter {
          throw "非Error文字列例外";
        },
      };

      let capturedError: Error | null = null;
      render(
        <ServiceProvider
          services={failingServices}
          fallback={(err) => {
            capturedError = err;
            return <div data-testid="error-fallback-str">{err?.message}</div>;
          }}
        >
          <div>子コンテンツ</div>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-fallback-str")).toBeInTheDocument();
      });
      expect((capturedError as Error | null)?.message).toBe(
        "非Error文字列例外",
      );
    });

    it("fallback が ReactNode の場合に初期化中またはエラー時に表示されること", async () => {
      render(
        <ServiceProvider
          fallback={<div data-testid="static-fallback">読み込み中...</div>}
        >
          <div>子コンテンツ</div>
        </ServiceProvider>,
      );

      // 初期状態
      expect(screen.getByTestId("static-fallback")).toBeInTheDocument();

      // 初期化完了後は子コンテンツが表示される
      await waitFor(() => {
        expect(screen.getByText("子コンテンツ")).toBeInTheDocument();
      });
    });

    it("storage が利用できない環境（null）での getStoredDatabaseBinary と persistDatabaseBinary の安全なフォールバック", () => {
      expect(getStoredDatabaseBinary(null)).toBeUndefined();
      expect(() =>
        persistDatabaseBinary(new Uint8Array([1, 2, 3]), null),
      ).not.toThrow();
    });

    it("createDefaultNativeSqliteAdapter がネイティブ接続を作成しスキーマ初期化を実行すること", async () => {
      const mockConn = {
        open: vi.fn().mockResolvedValue(undefined),
        execute: vi.fn().mockResolvedValue({ changes: {} }),
        run: vi.fn().mockResolvedValue({ changes: {} }),
        query: vi.fn().mockResolvedValue({ values: [] }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as SQLiteDBConnection;
      const createConnectionSpy = vi
        .spyOn(SQLiteConnection.prototype, "createConnection")
        .mockResolvedValue(mockConn);

      const adapter = await createDefaultNativeSqliteAdapter();
      expect(createConnectionSpy).toHaveBeenCalledWith(
        "yommy_poc.db",
        false,
        "no-encryption",
        1,
        false,
      );
      expect(mockConn.open).toHaveBeenCalled();
      expect(mockConn.execute).toHaveBeenCalled();
      expect(adapter).toBeDefined();

      createConnectionSpy.mockRestore();
    });

    it("Capacitor.isNativePlatform が true の場合にネイティブサービスが初期化されること", async () => {
      const isNativeSpy = vi
        .spyOn(Capacitor, "isNativePlatform")
        .mockReturnValue(true);

      const mockConn = {
        open: vi.fn().mockResolvedValue(undefined),
        execute: vi.fn().mockResolvedValue({ changes: {} }),
        run: vi.fn().mockResolvedValue({ changes: {} }),
        query: vi.fn().mockResolvedValue({ values: [] }),
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as SQLiteDBConnection;
      const createConnectionSpy = vi
        .spyOn(SQLiteConnection.prototype, "createConnection")
        .mockResolvedValue(mockConn);

      let serviceValue: ServiceContextValue | null = null;
      const TestConsumer: React.FC = () => {
        const services = useServices();
        serviceValue = services;
        return <div>ネイティブ実行テスト</div>;
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect((serviceValue as ServiceContextValue | null)?.isReady).toBe(
          true,
        );
      });
      expect(
        (serviceValue as ServiceContextValue | null)?.httpClient,
      ).toBeDefined();
      expect(
        (serviceValue as ServiceContextValue | null)?.databaseAdapter,
      ).toBeDefined();
      expect(
        (serviceValue as ServiceContextValue | null)?.appBridge,
      ).toBeInstanceOf(CapacitorAppBridge);

      createConnectionSpy.mockRestore();
      isNativeSpy.mockRestore();
    });

    it("Web 環境（isNativePlatform === false）でデフォルトの MockAppBridge が初期化されること (AC-AB-01)", async () => {
      let serviceValue: ServiceContextValue | null = null;
      const TestConsumer: React.FC = () => {
        serviceValue = useServices();
        return <div>Web 実行テスト</div>;
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect((serviceValue as ServiceContextValue | null)?.isReady).toBe(
          true,
        );
      });
      expect(
        (serviceValue as ServiceContextValue | null)?.appBridge,
      ).toBeInstanceOf(MockAppBridge);
    });

    it("外部からカスタム appBridge が提供された場合に優先して注入されること", async () => {
      const customAppBridge = new MockAppBridge();
      let serviceValue: ServiceContextValue | null = null;
      const TestConsumer: React.FC = () => {
        serviceValue = useServices();
        return <div>DI 注入テスト</div>;
      };

      render(
        <ServiceProvider services={{ appBridge: customAppBridge }}>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect((serviceValue as ServiceContextValue | null)?.isReady).toBe(
          true,
        );
      });
      expect((serviceValue as ServiceContextValue | null)?.appBridge).toBe(
        customAppBridge,
      );
    });

    it("初期化完了時に結合テスト用に window.__yommyServices が公開されること", async () => {
      render(
        <ServiceProvider>
          <div>サービス公開テスト</div>
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(window.__yommyServices?.isReady).toBe(true);
      });
      expect(window.__yommyServices?.httpClient).toBeDefined();
      expect(window.__yommyServices?.parserRegistry).toBeDefined();
      expect(window.__yommyServices?.novelRepository).toBeDefined();
      expect(window.__yommyServices?.chapterRepository).toBeDefined();
      expect(window.__yommyServices?.settingsRepository).toBeDefined();
      expect(window.__yommyServices?.appSettingsRepository).toBeDefined();
    });

    it("デフォルトで SqlAppSettingsRepository が初期化され設定値の保存・取得ができること", async () => {
      let settingValue: string | null = null;
      const TestConsumer: React.FC = () => {
        const services = useServices();
        return (
          <button
            onClick={async () => {
              await services.appSettingsRepository.setSetting(
                "bookshelf_sort_order",
                "title",
              );
              settingValue = await services.appSettingsRepository.getSetting(
                "bookshelf_sort_order",
              );
            }}
          >
            設定更新
          </button>
        );
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("設定更新")).toBeInTheDocument();
      });

      screen.getByText("設定更新").click();

      await waitFor(() => {
        expect(settingValue).toBe("title");
      });
    });

    it("デフォルトで MockCloudSyncBridge および SyncEngine が初期化されること", async () => {
      let syncBridgeInstance: unknown = null;
      let syncEngineInstance: unknown = null;

      const TestConsumer: React.FC = () => {
        const services = useServices();
        syncBridgeInstance = services.cloudSyncBridge;
        syncEngineInstance = services.syncEngine;
        return <div data-testid="consumer-ready">OK</div>;
      };

      render(
        <ServiceProvider>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("consumer-ready")).toBeInTheDocument();
      });

      expect(syncBridgeInstance).toBeInstanceOf(MockCloudSyncBridge);
      expect(syncEngineInstance).toBeDefined();
    });

    it("カスタムの cloudSyncBridge が services プロパティから正しく注入されること", async () => {
      const customBridge = new MockCloudSyncBridge({
        defaultEmail: "custom-sync@example.com",
      });
      let syncBridgeInstance: unknown = null;

      const TestConsumer: React.FC = () => {
        const services = useServices();
        syncBridgeInstance = services.cloudSyncBridge;
        return <div data-testid="consumer-ready">OK</div>;
      };

      render(
        <ServiceProvider services={{ cloudSyncBridge: customBridge }}>
          <TestConsumer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("consumer-ready")).toBeInTheDocument();
      });

      expect(syncBridgeInstance).toBe(customBridge);
      const auth = await (syncBridgeInstance as MockCloudSyncBridge).signIn();
      expect(auth).toEqual({
        status: "connected",
        email: "custom-sync@example.com",
      });
    });
  });
});
