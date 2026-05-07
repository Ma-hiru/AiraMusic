import { FC, memo } from "react";
import { useRequestAutoRun, useRequestStatusWrap } from "@mahiru/ui/public/hooks/useRequestWrap";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";

import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";

interface ArtistProps {
  id: number;
}

const Artist: FC<ArtistProps> = ({ id }) => {
  const { status, data: artist, fetchData } = useRequestStatusWrap(NeteaseServices.Artist.id);
  const { reload } = useRequestAutoRun(fetchData, [id]);

  return (
    <div>
      <AppErrorBoundary name="Artist" canReset toast onReset={reload}>
        <ThrowIf when={status === "error"} message="歌手加载失败" />
        <AppLoading loading={status === "loading"}>{artist?.name}</AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Artist);
