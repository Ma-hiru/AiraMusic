import { type FC, memo, useCallback } from "react";
import { Search } from "lucide-react";
import NoDrag from "@mahiru/ui/common/components/drag/NoDrag";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/common/source/electron/services";
import { useSearchRecommend } from "@mahiru/ui/common/hooks/useSearchRecommend";

const TopSearch: FC<object> = () => {
  const defaultKeywords = useSearchRecommend();

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
        onClick={() => openSearch(defaultKeywords ?? undefined)}>
        <span>{defaultKeywords}</span>
      </div>
      <Search
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out transition-all duration-300 active:scale-90"
        onClick={() => openSearch()}
      />
    </NoDrag>
  );
};
export default memo(TopSearch);
