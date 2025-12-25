import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API } from "@mahiru/ui/api";
import { SearchType } from "@mahiru/ui/api/search";
import { debounce } from "lodash-es";

export function useSearch(size: number = 50) {
  const [hotSearchList, setHotSearchList] = useState<NeteaseSearchHotListDetail[]>([]);
  const [defaultSearchKeyword, setDefaultSearchKeyword] =
    useState<Nullable<NeteaseSearchDefaultKeywords>>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searchResult, setSearchResult] = useState<Nullable<NeteaseSearchResult<"all">>>(null);
  const [searchType, setSearchType] = useState<SearchType>(SearchType.COMPREHENSIVE);
  const [keywords, setKeywords] = useState("");
  const hasMore = useRef(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalResult, setTotalResult] = useState(0);
  const totalPage = Math.ceil(totalResult / size);

  const requestSuggest = useMemo(() => debounce(searchSuggest, 300), []);

  const requestResult = useCallback(
    (pageNo: number) => {
      if (!keywords.trim()) return;
      if (!hasMore.current) return;
      setLoading(true);
      setFailed(false);
      API.Search.search({
        keywords,
        type: searchType,
        searchType: "NORMAL",
        offset: pageNo - 1,
        limit: size
      })
        .then((response) => {
          switch (searchType) {
            case SearchType.COMPREHENSIVE: {
              setSearchResult(response.result);
              setCurrentPage(pageNo);
              setTotalResult(size);
              hasMore.current = false;
              break;
            }
            case SearchType.SONG: {
              const songsResult = (response as NeteaseSearchResultResponse<"song">).result;
              setSearchResult(response.result);
              setTotalResult(songsResult.songCount);
              setCurrentPage(pageNo);
              hasMore.current = songsResult.hasMore;
              break;
            }
            case SearchType.ALBUM: {
              const albumsResult = (response as NeteaseSearchResultResponse<"album">).result;
              setSearchResult(response.result);
              setTotalResult(albumsResult.albumCount);
              setCurrentPage(pageNo);
              hasMore.current = pageNo * size < albumsResult.albumCount;
              break;
            }
            case SearchType.ARTIST: {
              const artistsResult = (response as NeteaseSearchResultResponse<"artist">).result;
              setSearchResult(response.result);
              setTotalResult(artistsResult.artistCount);
              setCurrentPage(pageNo);
              hasMore.current = artistsResult.hasMore;
              break;
            }
            case SearchType.PLAYLIST: {
              const playlistsResult = (response as NeteaseSearchResultResponse<"playlist">).result;
              setSearchResult(response.result);
              setTotalResult(playlistsResult.playlistCount);
              setCurrentPage(pageNo);
              hasMore.current = playlistsResult.hasMore;
              break;
            }
          }
          setSearchResult(response.result || response.data);
        })
        .catch(() => {
          setFailed(true);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [keywords, searchType, size]
  );

  useLayoutEffect(() => {
    setSearchResult(null);
    setLoading(false);
    setFailed(false);
    setCurrentPage(0);
    setTotalResult(0);
    hasMore.current = true;
    requestResult(1);
  }, [requestResult]);

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

  const changeSearchType = useCallback((type: SearchType) => {
    setSearchResult(null);
    return setSearchType(type);
  }, []);

  return {
    hotSearchList,
    defaultSearchKeyword,
    loading,
    failed,
    searchResult,
    requestSuggest,
    searchType,
    setKeywords,
    changeSearchType,
    keywords,
    totalPage,
    totalResult,
    currentPage,
    requestResult
  };
}

export const requestSuggest = debounce(searchSuggest, 300);

function searchSuggest(
  keyword: string,
  callback: NormalFunc<[result: NeteaseSearchSuggestionResponse["result"]]>
) {
  API.Search.searchSuggest(keyword).then((response) => {
    callback(response.result);
  });
}
