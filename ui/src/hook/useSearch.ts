import { useEffect, useMemo, useState } from "react";
import { API } from "@mahiru/ui/api";
import { SearchType } from "@mahiru/ui/api/search";
import { debounce } from "lodash-es";

export function useSearch(keywords: string, type: SearchType) {
  const [hotSearchList, setHotSearchList] = useState<NeteaseSearchHotListDetail[]>([]);
  const [defaultSearchKeyword, setDefaultSearchKeyword] =
    useState<Nullable<NeteaseSearchDefaultKeywords>>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searchResult, setSearchResult] = useState<Nullable<NeteaseSearchResult<"all">>>(null);

  const requestSuggest = useMemo(() => debounce(searchSuggest, 300), []);

  useEffect(() => {
    if (!keywords.trim()) {
      setSearchResult(null);
      return;
    }
    setLoading(true);
    setFailed(false);
    API.Search.search({
      keywords,
      type
    })
      .then((response) => {
        setSearchResult(response.data);
      })
      .catch(() => {
        setFailed(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [keywords, type]);

  useEffect(() => {
    API.Search.searchHotListDetail().then((response) => {
      setHotSearchList(response.data);
    });
    API.Search.searchDefaultKeywords().then((response) => {
      setDefaultSearchKeyword(response.data);
    });
    const timer = setInterval(() => {
      API.Search.searchDefaultKeywords().then((response) => {
        setDefaultSearchKeyword(response.data);
      });
    }, 60000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return {
    hotSearchList,
    defaultSearchKeyword,
    loading,
    failed,
    searchResult,
    requestSuggest
  };
}

function searchSuggest(
  keyword: string,
  callback: NormalFunc<[result: NeteaseSearchSuggestionResponse["result"]]>
) {
  API.Search.searchSuggest(keyword).then((response) => {
    callback(response.result);
  });
}
