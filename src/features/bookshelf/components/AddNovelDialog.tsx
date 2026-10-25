import React, { useState, useEffect } from "react";

export interface AddNovelDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (url: string) => void | Promise<void>;
}

const SAMPLE_KAKUYOMU_URL = "https://kakuyomu.jp/works/16817330658027210412";

/**
 * URLから作品を追加するモーダルダイアログ
 */
export const AddNovelDialog: React.FC<AddNovelDialogProps> = ({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setUrl("");
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!isSubmitting && trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  const handleFillSample = () => {
    setUrl(SAMPLE_KAKUYOMU_URL);
  };

  const isSubmitDisabled = isSubmitting || url.trim().length === 0;

  return (
    <div
      data-testid="add-novel-dialog-backdrop"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-novel-dialog-title"
        data-testid="add-novel-dialog"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-xl w-full max-w-md mx-auto"
      >
        <h2
          id="add-novel-dialog-title"
          className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2"
        >
          URLから作品を追加
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          カクヨムの作品トップまたはエピソードURLを入力してください。
        </p>

        {error && (
          <div
            data-testid="add-novel-error"
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-lg mb-4"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="novel-url-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              作品URL
            </label>
            <input
              id="novel-url-input"
              type="url"
              data-testid="add-novel-url-input"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isSubmitting}
              placeholder="https://kakuyomu.jp/works/..."
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
          </div>

          <div className="mb-6 flex justify-end">
            <button
              type="button"
              data-testid="fill-sample-url-button"
              onClick={handleFillSample}
              disabled={isSubmitting}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              サンプルURLを入力
            </button>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              data-testid="add-novel-cancel-button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              data-testid="add-novel-submit-button"
              disabled={isSubmitDisabled}
              className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-blue-400"
            >
              {isSubmitting ? "取得中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
