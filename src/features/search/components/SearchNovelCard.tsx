import React from "react";
import type { NovelSearchResultItem } from "../../../parsers/types";

export interface SearchNovelCardProps {
  item: NovelSearchResultItem;
  isRegistered: boolean;
  isAdding: boolean;
  onAdd: () => void;
  onSelect: () => void;
}

export const SearchNovelCard: React.FC<SearchNovelCardProps> = () => {
  return null;
};
