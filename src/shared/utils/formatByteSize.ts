/**
 * バイト容量フォーマット共通ユーティリティ
 *
 * 規約:
 * - bytes <= 0 または非有限数: "0 B"
 * - bytes < 1024: "${bytes} B"
 * - bytes < 1024 * 1024: "${(bytes / 1024).toFixed(1)} KB"
 * - bytes >= 1024 * 1024: "${(bytes / (1024 * 1024)).toFixed(1)} MB"
 */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const oneKb = 1024;
  const oneMb = 1024 * 1024;

  if (bytes < oneKb) {
    return `${bytes} B`;
  }

  if (bytes < oneMb) {
    return `${(bytes / oneKb).toFixed(1)} KB`;
  }

  return `${(bytes / oneMb).toFixed(1)} MB`;
}
