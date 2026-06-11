import { type FC, memo } from "react";

import Search from "@/common/components/data-input/search";
import PageAction from "@/common/components/display/page-action";

interface HeaderProps {
  count: number;
  searchTracks: NormalFunc<[k: string]>;
  setIsTyping?: NormalFunc<[tying: boolean]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
}

const Header: FC<HeaderProps> = ({
  count,
  searchTracks,
  setIsTyping = () => {},
  pageActionType,
  onPageAction
}) => {
  return (
    <div className="w-full mb-4 flex justify-between items-center select-none">
      <div className="min-w-0 flex items-baseline gap-2 truncate">
        <span className="font-bold text-[28px]">历史记录</span>
        <span className="text-[12px] font-semibold opacity-40">{count} 条记录</span>
      </div>
      <div className="flex items-center gap-3">
        <Search onSearch={searchTracks} setIsTyping={setIsTyping} />
        <PageAction type={pageActionType} onClick={onPageAction} />
      </div>
    </div>
  );
};

export default memo(Header);
