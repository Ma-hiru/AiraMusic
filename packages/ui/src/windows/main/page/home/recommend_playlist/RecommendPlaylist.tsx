import { FC, memo, useMemo, useRef } from "react";
import { NeteaseAPIPlaylist } from "@mahiru/ui/common/source/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@mahiru/ui/common/hooks/useRequestWrap";

import PlaylistList from "./list";
import AppErrorBoundary, {
  AppErrorBoundaryRef
} from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/common/components/fallback/ThrowIf";
import AppLoading from "@mahiru/ui/common/components/fallback/AppLoading";

const RecommendPlaylist: FC<object> = () => {
  const { status, data, fetchData } = useRequestStatusWrap(NeteaseAPIPlaylist.recommend);
  const { reload } = useRequestAutoRetry(fetchData, [120], () => (data?.result ?? []).length !== 0);
  const errRef = useRef<AppErrorBoundaryRef>({});
  const recommend = useMemo(() => {
    if (!data || !data.result) return [];
    const set = new Set<string>();
    return data.result.filter((item) => {
      if (set.has(String(item.id))) return false;
      set.add(String(item.id));
      return true;
    });
  }, [data]);

  return (
    <div className="w-full overflow-hidden contain-layout pb-18">
      <h1 className="font-bold text-lg text-(--text-color-on-main)">推荐歌单</h1>
      <AppErrorBoundary
        ref={errRef}
        name="RecommendPlaylist"
        className="w-full h-auto"
        showError
        canReset
        toast={false}
        onReset={reload}>
        <ThrowIf when={status === "error"} />
        <AppLoading loading={status === "loading"} className="h-auto w-full">
          <PlaylistList recommend={recommend} />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};
export default memo(RecommendPlaylist);
