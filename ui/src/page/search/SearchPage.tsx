import { FC, memo, useEffect, useState } from "react";
import { useInfoCtx, useInfoThemeCtx } from "@mahiru/ui/ctx/InfoCtx";
import { API } from "@mahiru/ui/api";
import { useSearch } from "@mahiru/ui/hook/useSearch";
import { SearchType } from "@mahiru/ui/api/search";

const SearchPage: FC<object> = () => {
  const infoSync = useInfoCtx<"search">();
  const themeSync = useInfoThemeCtx();
  const [keywords, setKeywords] = useState("");
  const [searchType, setSearchType] = useState<SearchType>(SearchType.SONG);
  // const { requestSuggest, searchResult, defaultSearchKeyword, hotSearchList } = useSearch(
  //   keywords,
  //   searchType
  // );
  useEffect(() => {
    setKeywords(infoSync.value);
  }, [infoSync.value]);
  return (
    <button
      className="bg-black  cursor-pointer"
      onClick={() => {
        API.Search.searchSuggest("光");
      }}>
      test
    </button>
  );
};
export default memo(SearchPage);
