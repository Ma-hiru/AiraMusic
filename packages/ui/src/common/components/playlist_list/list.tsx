import { type FC, memo, type Ref } from "react";
import Item from "./item";
import { cx } from "@emotion/css";

interface ListProps {
  ref?: Ref<HTMLDivElement>;
  list: { id: number; name: string; picUrl: string; trackCount?: number; playCount?: number }[];
  shadowColor?: "dark" | "light";
  coverSize?: number;
  className?: string;
  onClickItem?: NormalFunc<[id: number]>;
}

const PlaylistList: FC<ListProps> = ({
  ref,
  className,
  list,
  shadowColor,
  coverSize,
  onClickItem
}) => {
  return (
    <div
      ref={ref}
      className={cx(
        "relative w-full my-2 gap-2 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] items-start content-stretch",
        className
      )}>
      {list.map((playlist) => (
        <Item
          key={playlist.id}
          cover={playlist.picUrl}
          name={playlist.name}
          trackCount={playlist.trackCount}
          playCount={playlist.playCount}
          shadowColor={shadowColor}
          coverSize={coverSize}
          onClick={() => onClickItem?.(playlist.id)}
        />
      ))}
    </div>
  );
};

export default memo(PlaylistList);
