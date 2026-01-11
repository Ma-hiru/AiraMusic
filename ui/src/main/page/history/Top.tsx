import { FC, memo } from "react";
import Title from "@mahiru/ui/main/componets/Title";
import Search from "@mahiru/ui/public/components/public/Search";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

interface TopProps {
  searchTracks: NormalFunc<[k: string]>;
  recordCount: number;
}

const Top: FC<TopProps> = ({ searchTracks, recordCount }) => {
  const { SetIsTyping } = useLayoutStore(["SetIsTyping"]);
  return (
    <div className="mb-1">
      <Title
        title={
          <div className="flex items-center">
            <span>历史记录</span>
            <span className="text-black/30 scale-80">({recordCount} 记录)</span>
          </div>
        }
        slot={<Search searchTracks={searchTracks} setIsTyping={SetIsTyping} />}
      />
    </div>
  );
};
export default memo(Top);
