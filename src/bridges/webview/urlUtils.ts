/**
 * 指定された URL が https: の安全な Web URL スキームであるか判定する。
 * （平文 http: は Android cleartextTraffic 制限およびセキュリティ境界の観点から遮断し https: のみ許可）
 *
 * @param url 検証対象の URL 文字列
 * @returns https: の場合 true、危険スキームや平文 http・不正な形式の場合 false
 */
export function isValidHttpUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 危険または不正な URL スキームに対する例外インスタンスを生成する。
 *
 * @param url 指定された危険な URL
 * @returns 説明付き Error インスタンス
 */
export function createUnsafeSchemeError(url: string): Error {
  return new Error(`Invalid or unsafe URL scheme: ${url}`);
}
