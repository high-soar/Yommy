import type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
} from "../../parsers/types";

export type {
  NovelSearchOrder,
  NovelSearchResultItem,
  NovelSerialStatus,
  NovelSiteType,
};

/**
 * 検索対象サイトの選択肢定義
 */
export interface SearchSiteOption {
  readonly siteType: NovelSiteType;
  readonly label: string;
  readonly isAvailable: boolean;
}

/**
 * 並び順の選択肢定義
 */
export interface SearchOrderOption {
  readonly value: NovelSearchOrder;
  readonly label: string;
}

/**
 * 連載状況の選択肢定義
 */
export interface SearchSerialStatusOption {
  readonly value: NovelSerialStatus;
  readonly label: string;
}

/**
 * カクヨム主要12ジャンルの選択肢定義
 */
export interface SearchGenreOption {
  readonly id?: string;
  readonly label: string;
}
