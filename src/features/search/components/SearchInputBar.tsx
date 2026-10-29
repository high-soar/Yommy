import React from "react";

export interface SearchInputBarProps {
  keyword: string;
  onChangeKeyword: (keyword: string) => void;
  onSubmitSearch: () => void;
}

export const SearchInputBar: React.FC<SearchInputBarProps> = () => {
  return null;
};
