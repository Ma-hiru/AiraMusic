import { FC, memo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useThemeSyncReceive } from "@mahiru/ui/public/hooks/useThemeSyncReceive";
import { useInfoCtx } from "@mahiru/ui/info/ctx/InfoCtx";
import { useSearch } from "@mahiru/ui/info/hooks/useSearch";
import { SearchType } from "@mahiru/ui/public/enum";

import SearchResult from "./SearchResult";
import SearchHostList from "./SearchHostList";
import SearchInput, { SearchInputRef } from "./SearchInput";

const SearchPage: FC<object> = () => {
  const infoSync = useInfoCtx<"search">();
  const { themeSync } = useThemeSyncReceive();
  const searchInputRef = useRef<Nullable<SearchInputRef>>(null);

  const {
    searchResult,
    defaultSearchKeyword,
    hotSearchList,
    setKeywords,
    changeSearchType,
    searchType,
    keywords,
    requestResult,
    currentPage,
    totalResult,
    totalPage
  } = useSearch();
  const active = !!keywords;

  useEffect(() => {
    setKeywords(infoSync.value);
  }, [infoSync.value, setKeywords]);

  return (
    <div className="w-screen h-screen relative pt-10">
      <motion.div
        className="w-full h-full px-8 flex items-center justify-center flex-col"
        animate={active ? { height: 50 } : { height: "100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}>
        <SearchInput
          themeSync={themeSync}
          ref={searchInputRef}
          setKeywords={setKeywords}
          placeholder={defaultSearchKeyword?.showKeyword.toString() || "搜索音乐、歌词、电台、用户"}
        />
        <SearchHostList
          show={!active}
          themeSync={themeSync}
          hotSearchList={hotSearchList}
          onClick={(hot) => {
            setKeywords(hot);
            searchInputRef.current?.setInputWords(hot);
            changeSearchType(SearchType.COMPREHENSIVE);
          }}
        />
      </motion.div>
      <SearchResult
        themeSync={themeSync}
        data={searchResult}
        type={searchType}
        setSearchType={changeSearchType}
        requestResult={requestResult}
        currentPage={currentPage}
        totalResult={totalResult}
        totalPage={totalPage}
      />
    </div>
  );
};
export default memo(SearchPage);
