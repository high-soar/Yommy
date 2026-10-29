import React from "react";
import type {
  NovelSearchOrder,
  NovelSerialStatus,
} from "../../../parsers/types";

export interface SearchFilterBarProps {
  selectedOrder: NovelSearchOrder;
  onSelectOrder: (order: NovelSearchOrder) => void;
  selectedSerialStatus: NovelSerialStatus;
  onSelectSerialStatus: (status: NovelSerialStatus) => void;
  selectedGenre?: string;
  onSelectGenre: (genre?: string) => void;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = () => {
  return null;
};
