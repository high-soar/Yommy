import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Worktree 環境変数自動同期スクリプト
 *
 * メイン Worktree (/workspaces/Yommy/.env.local) から
 * カレント Worktree へ .env.local を安全に自動コピーする
 * （ゼロコンフィグでのテスト・ビルド PASS 保証および環境変数基盤）
 *
 * @param {import("./sync-env.d.mts").SyncEnvOptions} [options]
 */
export function syncEnv(options = {}) {
  try {
    const currentDir = options.currentDir ?? process.cwd();
    const targetPath = path.resolve(currentDir, ".env.local");

    // 既にカレントに .env.local が存在する場合は何もしない
    if (fs.existsSync(targetPath)) {
      return;
    }

    // メイン Worktree 候補パスの決定
    let candidates = options.mainCandidates ? [...options.mainCandidates] : [];
    if (candidates.length === 0) {
      try {
        const commonDir = execSync("git rev-parse --git-common-dir", {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        const resolvedCommonDir = path.resolve(currentDir, commonDir);
        const mainRepoDir = path.dirname(resolvedCommonDir);
        candidates.push(path.join(mainRepoDir, ".env.local"));
      } catch {
        // git コマンド実行失敗時はフォールバック
      }
      candidates.push("/workspaces/Yommy/.env.local");
    }

    for (const candidate of candidates) {
      const resolvedCandidate = path.resolve(candidate);
      if (resolvedCandidate === targetPath) {
        continue;
      }
      if (fs.existsSync(resolvedCandidate)) {
        fs.copyFileSync(resolvedCandidate, targetPath);
        console.log(`[sync-env] .env.local copied from ${resolvedCandidate}`);
        return;
      }
    }
  } catch (error) {
    console.warn("[sync-env] Warning: Failed to sync .env.local:", error);
  }
}

// 直接実行された場合のハンドラ
const isMain =
  Boolean(process.argv[1]) &&
  (import.meta.url === `file://${path.resolve(process.argv[1])}` ||
    process.argv[1].endsWith("sync-env.mjs"));

if (isMain) {
  syncEnv();
}
