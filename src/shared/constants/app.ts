import { version as PACKAGE_VERSION } from "../../../package.json";

/**
 * アプリケーション基本メタデータ定数定義（SSOT: package.json）
 * (docs/specs/features/settings.md §3.2, docs/specs/architecture.md §5.4)
 */

/**
 * アプリケーション表示名称
 */
export const APP_NAME = "Yommy";

/**
 * アプリケーションセマンティックバージョン（package.json の version と連動）
 */
export const APP_VERSION: string = PACKAGE_VERSION;
