import Color from "color";
import { FC, memo, useMemo, useRef } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

import PlaylistList from "./list";
import AppErrorBoundary, {
  AppErrorBoundaryRef
} from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import { useRequestAutoRetry, useRequestStatusWrap } from "@mahiru/ui/public/hooks/useRequestWrap";

const RecommendPlaylist: FC<object> = () => {
  const { mainColor } = useThemeColor();
  const { status, data, fetchData } = useRequestStatusWrap(NeteaseAPI.Playlist.recommend);
  const { reload } = useRequestAutoRetry(fetchData, [120], () => (data?.result ?? []).length !== 0);
  const errRef = useRef<AppErrorBoundaryRef>({});
  const titleColor = Color("#000000").mix(Color(mainColor), 0.2).string();
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
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        推荐歌单
      </h1>
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
