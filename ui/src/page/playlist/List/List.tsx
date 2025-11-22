import { ComponentProps, FC, memo, useRef } from "react";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { css, cx } from "@emotion/css";
import ListItem from "@mahiru/ui/page/playlist/List/ListItem";
import { useVirtualList, RowComponentType } from "@mahiru/ui/hook/useVirtualList";

interface ListProps {
  filterTracks: NeteasePlaylistDetailResponse["playlist"]["tracks"];
  isLikedList?: boolean;
}

const ListContainer: FC<ListProps> = ({ filterTracks, isLikedList }) => {
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  const List = useVirtualList(filterTracks, containerRef, 10, 50);
  return (
    <div
      ref={containerRef}
      className={cx(
        "w-full overflow-y-auto h-[calc(100%-210px)] contain-content will-change-scroll",
        css`
          scrollbar-width: none;
          -webkit-overflow-scrolling: auto;
        `
      )}>
      <List RowComponent={RowComponent} />
    </div>
  );
};

export default memo(ListContainer);

function RowComponent(props: ComponentProps<RowComponentType<NeteaseTrack>>) {
  const { index, items } = props;
  return <ListItem index={index} data={items} />;
}
