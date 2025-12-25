import { FC, memo, useEffect, useRef } from "react";
import { useInfoCtx, useInfoThemeCtx } from "@mahiru/ui/ctx/InfoCtx";
import { SearchType } from "@mahiru/ui/api/search";
import { motion } from "motion/react";
import { useSearch } from "@mahiru/ui/hook/useSearch";
import SearchResult from "@mahiru/ui/page/search/SearchResult";
import SearchHostList from "@mahiru/ui/page/search/SearchHostList";
import SearchInput, { SearchInputRef } from "@mahiru/ui/page/search/SearchInput";

const SearchPage: FC<object> = () => {
  const infoSync = useInfoCtx<"search">();
  const themeSync = useInfoThemeCtx();
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
