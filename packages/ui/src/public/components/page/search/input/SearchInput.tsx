import { FC, memo, useState } from "react";
import { Search } from "lucide-react";

interface SearchInputProps {
  className?: string;
  placeholder: Optional<string>;
  onSearch: NormalFunc<[keyword: string]>;
}

const SearchInput: FC<SearchInputProps> = ({ className, placeholder, onSearch }) => {
  const [keyword, setKeyword] = useState("");
  return (
    <div className={className}>
      <input
        type="text"
        placeholder={placeholder ?? "请输入搜索关键词"}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyUp={(e) => e.key === "Enter" && onSearch(keyword)}
      />
      <Search />
    </div>
  );
};

export default memo(SearchInput);
