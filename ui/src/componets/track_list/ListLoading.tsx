import { FC, memo } from "react";
import Loading from "@mahiru/ui/componets/public/Loading";
import { ColorInstance } from "color";

interface ListLoadingProps {
  loading?: boolean;
  requestMissedTracks?: number;
  mainColor: ColorInstance;
}

const ListLoading: FC<ListLoadingProps> = ({ loading, mainColor, requestMissedTracks }) => {
  return (
    <div
      style={{ color: mainColor.hex(), display: loading ? "flex" : "none" }}
      className={`
        absolute flex flex-col justify-center items-center gap-1
        left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2
        font-medium text-lg select-none
      `}>
      <Loading className="size-8" />
      {requestMissedTracks ? (
        <span className="font-semibold">歌曲较多，正在获取 {requestMissedTracks} 首歌曲详情</span>
      ) : (
        <span className="font-semibold">加载中</span>
      )}
    </div>
  );
};
export default memo(ListLoading);
