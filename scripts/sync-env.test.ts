import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { syncEnv } from "./sync-env.mjs";

describe("syncEnv (Worktree 環境変数自動同期基盤)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("カレントディレクトリに既に .env.local が存在する場合、コピーを行わず何もしないこと", () => {
    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (String(p).endsWith(".env.local")) return true;
      return false;
    });
    const copyFileSyncSpy = vi
      .spyOn(fs, "copyFileSync")
      .mockImplementation(() => {});

    syncEnv({
      currentDir: "/workspaces/Yommy/worktree-1",
      mainCandidates: ["/workspaces/Yommy/.env.local"],
    });

    expect(existsSyncSpy).toHaveBeenCalled();
    expect(copyFileSyncSpy).not.toHaveBeenCalled();
  });

  it("カレントに .env.local がなく、メイン Worktree に存在する場合、安全にコピーされること", () => {
    const currentEnv = path.resolve(
      "/workspaces/Yommy/worktree-1",
      ".env.local",
    );
    const mainEnv = path.resolve("/workspaces/Yommy", ".env.local");

    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (path.resolve(String(p)) === currentEnv) return false;
      if (path.resolve(String(p)) === mainEnv) return true;
      return false;
    });
    const copyFileSyncSpy = vi
      .spyOn(fs, "copyFileSync")
      .mockImplementation(() => {});

    syncEnv({
      currentDir: "/workspaces/Yommy/worktree-1",
      mainCandidates: [mainEnv],
    });

    expect(copyFileSyncSpy).toHaveBeenCalledWith(mainEnv, currentEnv);
  });

  it("メイン Worktree の候補いずれにも .env.local が存在しない場合、何もしないこと", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const copyFileSyncSpy = vi
      .spyOn(fs, "copyFileSync")
      .mockImplementation(() => {});

    syncEnv({
      currentDir: "/workspaces/Yommy/worktree-1",
      mainCandidates: ["/non/existent/.env.local"],
    });

    expect(copyFileSyncSpy).not.toHaveBeenCalled();
  });

  it("fs.copyFileSync 実行中にエラーが発生した場合でも、例外をキャッチしてクラッシュしないこと", () => {
    const currentEnv = path.resolve(
      "/workspaces/Yommy/worktree-1",
      ".env.local",
    );
    const mainEnv = path.resolve("/workspaces/Yommy", ".env.local");

    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (path.resolve(String(p)) === currentEnv) return false;
      if (path.resolve(String(p)) === mainEnv) return true;
      return false;
    });
    vi.spyOn(fs, "copyFileSync").mockImplementation(() => {
      throw new Error("Permission denied");
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => {
      syncEnv({
        currentDir: "/workspaces/Yommy/worktree-1",
        mainCandidates: [mainEnv],
      });
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
  });

  it("カレントディレクトリとメイン候補のパスが同一の場合はコピーを行わないこと", () => {
    const sameEnv = path.resolve("/workspaces/Yommy", ".env.local");

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const copyFileSyncSpy = vi
      .spyOn(fs, "copyFileSync")
      .mockImplementation(() => {});

    syncEnv({
      currentDir: "/workspaces/Yommy",
      mainCandidates: [sameEnv],
    });

    expect(copyFileSyncSpy).not.toHaveBeenCalled();
  });

  it("引数なしで呼び出された場合でも例外を投げずに安全に完了すること", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    expect(() => {
      syncEnv();
    }).not.toThrow();
  });
});
