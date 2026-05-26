import { useEffect, useState } from "react";
import { NeteaseAPISearch } from "@/common/netease/api";

export function useSearchRecommend() {
  const [defaultKeywords, setDefaultKeywords] =
    useState<Nullable<NeteaseAPI.NeteaseSearchDefaultKeywords>>(null);

  useEffect(() => {
    let cancel = false;
    NeteaseAPISearch.defaultKeywords().then((response) => {
      if (cancel) return;
      setDefaultKeywords(response.data);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      NeteaseAPISearch.defaultKeywords().then((response) => {
        setDefaultKeywords(response.data);
      });
    }, 60000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return defaultKeywords?.showKeyword ?? null;
}
