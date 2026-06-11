import { type FC, memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { debounce } from "lodash-es";
import { cx } from "@emotion/css";

interface SearchProps {
  onSearch: NormalFunc<[k: string]>;
  setIsTyping: NormalFunc<[isTyping: boolean]>;
  containerClass?: string;
  inputClass?: string;
  placeholder?: string;
  iconClass?: string;
}

const Search: FC<SearchProps> = ({
  onSearch,
  setIsTyping,
  containerClass,
  inputClass,
  placeholder,
  iconClass
}) => {
  const [value, setValue] = useState("");
  const debouncedSearch = useMemo(() => debounce(onSearch, 300), [onSearch]);
  const deferredValue = useDeferredValue(value);

  useEffect(() => {
    debouncedSearch(deferredValue);
  }, [deferredValue, debouncedSearch]);

  return (
    <div className={cx("font-semibold relative inline-block text-(--text-color)", containerClass)}>
      <input
        type="text"
        value={value}
        placeholder={placeholder ?? "搜索"}
        onFocus={() => setIsTyping(true)}
        onBlur={() => setIsTyping(false)}
        onChange={(e) => setValue(e.target.value)}
        className={cx(
          `
          outline-(--text-color)
          block h-6 px-3 pr-8 w-18 focus:w-48 rounded-full
          border border-(--text-color)/30
          placeholder:text-(--text-color)/50
          ease-in-out transition-all duration-300
          text-[12px]
        `,
          inputClass
        )}
      />
      <SearchIcon
        className={cx(
          "absolute top-1/2 right-2 -translate-y-1/2 size-4  opacity-50 pointer-events-none",
          iconClass
        )}
      />
    </div>
  );
};

export default memo(Search);
