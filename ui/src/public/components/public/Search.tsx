import { FC, memo, startTransition, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { debounce } from "lodash-es";

interface SearchProps {
  searchTracks: NormalFunc<[k: string]>;
  setIsTyping: NormalFunc<[isTyping: boolean]>;
}

const Search: FC<SearchProps> = ({ searchTracks, setIsTyping }) => {
  const [value, setValue] = useState("");
  const debouncedSearch = debounce(searchTracks, 300);
  return (
    <div className="my-2 relative flex justify-end items-center font-semibold">
      <div className="relative inline-block">
        <input
          value={value}
          type="text"
          placeholder="搜索"
          onFocus={() => setIsTyping(true)}
          onBlur={() => setIsTyping(false)}
          className="block h-6 px-3 rounded-full border border-gray-300/60 focus:outline-none text-[12px]  placeholder-black/10 pr-8 w-18 focus:w-48 ease-in-out transition-all duration-300 placeholder:select-none"
          onChange={(e) => {
            setValue(e.target.value);
            startTransition(() => {
              debouncedSearch(e.target.value);
            });
          }}
        />
        <SearchIcon className="absolute top-1/2 right-2 -translate-y-1/2 size-4 text-black/20" />
      </div>
    </div>
  );
};
export default memo(Search);
