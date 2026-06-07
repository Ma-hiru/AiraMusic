import { type FC, memo, useCallback } from "react";
import { Search } from "lucide-react";
import NoDrag from "@/common/components/layout/drag/no-drag";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import { useSearchRecommend } from "@/common/hooks/use-search-recommend";

const TopSearch: FC<object> = () => {
  const defaultKeywords = useSearchRecommend();

  const openSearch = useCallback(async (keyword?: string) => {
    await RendererWindow.display.reactReadyAwait();
    RendererEventBus.display.send({
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
