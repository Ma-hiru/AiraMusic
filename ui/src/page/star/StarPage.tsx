import { FC, memo } from "react";
import PlayListPage from "@mahiru/ui/page/playlist/PlayListPage";
import { useDynamicZustandShallowStore } from "@mahiru/ui/store";

const StarPage: FC<object> = () => {
  const { userLikedPlayList } = useDynamicZustandShallowStore(["userLikedPlayList"]);
  return <PlayListPage setId={userLikedPlayList?.id || undefined} isLikedList={true} />;
};
export default memo(StarPage);
