import { FC, memo, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { NoDrag } from "@mahiru/ui/componets/public/Drag";
import { API } from "@mahiru/ui/api";
import { useInfoWindow } from "@mahiru/ui/hook/useInfoWindow";

const TopSearch: FC<object> = () => {
  const [defaultKeywords, setDefaultKeywords] =
    useState<Nullable<NeteaseSearchDefaultKeywords>>(null);
  const { openInfoWindow } = useInfoWindow(true);

  useEffect(() => {
    API.Search.searchDefaultKeywords().then((response) => {
      setDefaultKeywords(response.data);
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      API.Search.searchDefaultKeywords().then((response) => {
        setDefaultKeywords(response.data);
      });
    }, 60000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <NoDrag className="flex justify-center items-center gap-2">
      <div
        className="h-5 rounded-full border px-2 py-1 text-[10px] font-semibold flex justify-center items-center select-none border-white/10 bg-white/10 shadow-sm cursor-pointer"
        onClick={() => {
          openInfoWindow("search", defaultKeywords?.realkeyword || "");
        }}>
        <span>{defaultKeywords?.showKeyword}</span>
      </div>
      <Search
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
        onClick={() => {
          openInfoWindow("search", "");
        }}
      />
    </NoDrag>
  );
};
export default memo(TopSearch);
