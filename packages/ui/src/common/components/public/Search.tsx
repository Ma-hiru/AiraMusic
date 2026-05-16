import { FC, memo, useDeferredValue, useEffect, useMemo, useState } from "react";
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
    <div className="my-2 relative flex justify-end items-center font-semibold">
      <div className="relative inline-block">
        <input
          value={value}
          type="text"
          placeholder="搜索"
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
          onChange={(e) => setValue(e.target.value)}
          className={`
            focus:outline-none focus:ring-1 focus:ring-(--text-color-on-main)/50
            placeholder-(--text-color-on-main)/50 placeholder:select-none
            block h-6 px-3 pr-8 w-18 focus:w-48 rounded-full
            border border-(--text-color-on-main)/50
            ease-in-out transition-all duration-300
            text-[12px]
          `}
        />
        <SearchIcon className="absolute top-1/2 right-2 -translate-y-1/2 size-4 text-(--text-color-on-main)/50" />
      </div>
    </div>
  );
};
export default memo(Search);
