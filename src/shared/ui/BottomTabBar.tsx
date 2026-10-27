import React from "react";

export type BottomTab = "bookshelf" | "settings";

export interface BottomTabBarProps {
  /** 現在アクティブなタブ */
  activeTab: BottomTab;
  /** 「本棚」タブ選択時のコールバック */
  onSelectBookshelf: () => void;
  /** 「設定」タブ選択時のコールバック */
  onSelectSettings: () => void;
  /** 追加の CSS クラス（任意） */
  className?: string;
}

/**
 * 画面最下部に固定表示される下部タブバー（Presentational）
 */
export const BottomTabBar: React.FC<BottomTabBarProps> = () => {
  return null;
};
