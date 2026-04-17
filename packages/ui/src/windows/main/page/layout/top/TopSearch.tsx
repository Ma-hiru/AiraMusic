import { FC, memo, useEffect, useState } from "react";
import { Search } from "lucide-react";
import NoDrag from "@mahiru/ui/public/components/drag/NoDrag";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

const TopSearch: FC<object> = () => {
  const [defaultKeywords, setDefaultKeywords] =
    useState<Nullable<NeteaseAPI.NeteaseSearchDefaultKeywords>>(null);

  useEffect(() => {
    NeteaseAPI.Search.defaultKeywords().then((response) => {
      setDefaultKeywords(response.data);
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      NeteaseAPI.Search.defaultKeywords().then((response) => {
        setDefaultKeywords(response.data);
      });
    }, 60000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <NoDrag className="flex justify-center items-center gap-2">
      <div className="h-5 rounded-full border px-2 py-1 text-[10px] font-semibold flex justify-center items-center select-none border-white/10 bg-white/10 shadow-sm cursor-pointer">
        <span>{defaultKeywords?.showKeyword}</span>
      </div>
      <Search className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90" />
    </NoDrag>
  );
};
export default memo(TopSearch);
