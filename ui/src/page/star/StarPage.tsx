import { FC, memo } from "react";
import PlayListPage from "@mahiru/ui/page/playlist/PlayListPage";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";

const StarPage: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  return <PlayListPage setId={data.userLikedList?.id || undefined} />;
};
export default memo(StarPage);
