import { cx } from "@emotion/css";
import { debounce } from "lodash-es";
import { Search as SearchIcon } from "lucide-react";
import { memo, type FC, useMemo, useState, useEffect, useDeferredValue } from "react";

interface SearchProps {
  iconClass?: string;
  inputClass?: string;
  placeholder?: string;
  containerClass?: string;
  setIsTyping: NormalFunc<[isTyping: boolean]>;
  onSearch: NormalFunc<[k: string]>;
}

const Search: FC<SearchProps> = ({
  setIsTyping,
  onSearch,
  iconClass,
  inputClass,
  placeholder,
  containerClass
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
        type="text"
        value={value}
        placeholder={placeholder ?? "搜索"}
        onBlur={() => setIsTyping(false)}
        onFocus={() => setIsTyping(true)}
        onChange={(e) => setValue(e.target.value)}
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
