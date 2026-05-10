import { FC, memo, useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { NeteaseAPISearch } from "@mahiru/ui/public/source/netease/api";
import NoDrag from "@mahiru/ui/public/components/drag/NoDrag";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";

const TopSearch: FC<object> = () => {
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

  const openSearch = useCallback(async (keyword?: string) => {
    await ElectronServicesWindow.display.openAwait();
    ElectronServicesBus.display.send({
      type: "search",
      keyword
    });
  }, []);

  return (
    <NoDrag className="flex justify-center items-center gap-2">
      <div
        className="h-5 rounded-full border px-2 py-1 text-[10px] font-semibold flex justify-center items-center select-none border-white/10 bg-white/10 shadow-sm cursor-pointer"
        onClick={() => openSearch(defaultKeywords?.showKeyword)}>
        <span>{defaultKeywords?.showKeyword}</span>
      </div>
      <Search
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
        onClick={() => openSearch()}
      />
    </NoDrag>
  );
};
export default memo(TopSearch);
