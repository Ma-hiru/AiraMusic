import { FC, memo, startTransition, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath } from "@mahiru/ui/public/routes";
import { NeteaseAlbum } from "@mahiru/ui/public/source/netease/models";
import { Log } from "@mahiru/ui/public/utils/dev";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";

import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";

const AlbumPage: FC<object> = () => {
  const { id } = RoutePath.parseQuery<{ id: number }>(useLocation());
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [album, setAlbum] = useState<Nullable<NeteaseAlbum>>(null);
  const [dynamic, setDynamic] =
    useState<Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>>(null);

  const update = useUpdate();
  const reload = useCallback(() => {
    setStatus("loading");
    setAlbum(null);
    setDynamic(null);
    update();
  }, [update]);

  useEffect(() => {
    if (!id) return;
    let cancel = false;

    const tasks = [NeteaseServices.Album.id(id), NeteaseServices.Album.dynamic(id)] as const;
    setStatus("loading");
    Promise.all(tasks)
      .then(([album, dynamic]) => {
        if (cancel) return;
        startTransition(() => {
          setAlbum(album);
          setDynamic(dynamic);
          setStatus("success");
        });
      })
      .catch((err) => {
        if (cancel) return;
        Log.error(err);
        startTransition(() => {
          setStatus("error");
        });
      });

    return () => {
      cancel = true;
    };
  }, [
    id,
    // reload
    update.count
  ]);

  return (
    <div className="router-container">
      <AppErrorBoundary name="AlbumPage" canReset className="w-full h-full" toast onReset={reload}>
        <ThrowIf when={status === "error"} message="加载专辑失败" />
        <AppLoading loading={status === "loading"}></AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(AlbumPage);
