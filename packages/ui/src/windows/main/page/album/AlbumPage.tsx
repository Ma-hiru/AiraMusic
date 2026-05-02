import { FC, memo, startTransition, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath } from "@mahiru/ui/public/routes";
import { NeteaseAlbum } from "@mahiru/ui/public/source/netease/models";
import { Log } from "@mahiru/ui/public/utils/dev";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";

const AlbumPage: FC<object> = () => {
  const { id } = RoutePath.parseQuery<{ id: number }>(useLocation());
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [album, setAlbum] = useState<Nullable<NeteaseAlbum>>(null);
  const [dynamic, setDynamic] =
    useState<Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>>(null);

  useEffect(() => {
    let cancel = false;

    setStatus("loading");
    Promise.all([NeteaseServices.Album.id(id), NeteaseServices.Album.dynamic(id)])
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
  }, [id]);

  return (
    <div className="router-container">
      <AppLoading loading={status === "loading"}></AppLoading>
    </div>
  );
};

export default memo(AlbumPage);
