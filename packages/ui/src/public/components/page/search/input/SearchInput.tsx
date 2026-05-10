import { FC, memo, useState } from "react";

interface SearchInputProps {
  className?: string;
  placeholder: Optional<string>;
  onSearch: NormalFunc<[keyword: string]>;
}

const SearchInput: FC<SearchInputProps> = ({ className, placeholder, onSearch }) => {
  const [keyword, setKeyword] = useState("");
  return <></>;
};

export default memo(SearchInput);
