import { type FC, memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { debounce } from "lodash-es";

interface SearchProps {
  searchTracks: NormalFunc<[k: string]>;
  setIsTyping: NormalFunc<[isTyping: boolean]>;
}

const Search: FC<SearchProps> = ({ searchTracks, setIsTyping }) => {
  const [value, setValue] = useState("");
  const debouncedSearch = useMemo(() => debounce(searchTracks, 300), [searchTracks]);
  const deferredValue = useDeferredValue(value);

  useEffect(() => {
    debouncedSearch(deferredValue);
  }, [deferredValue, debouncedSearch]);

  return (
    <div className="my-2 font-semibold relative inline-block text-(--text-color)">
      <input
        value={value}
        type="text"
        placeholder="搜索"
        onFocus={() => setIsTyping(true)}
        onBlur={() => setIsTyping(false)}
        onChange={(e) => setValue(e.target.value)}
        className="
          outline-(--text-color)
          block h-6 px-3 pr-8 w-18 focus:w-48 rounded-full
          border border-(--text-color)/30
          placeholder:text-(--text-color)/50
          ease-in-out transition-all duration-300
          text-[12px]
         "
      />
      <SearchIcon className="absolute top-1/2 right-2 -translate-y-1/2 size-4  opacity-50" />
    </div>
  );
};
export default memo(Search);
