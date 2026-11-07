import { useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "@/common/store/user";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import type { Location } from "react-router-dom";
import type { MessageData } from "@mahiru/ipc/types";

export function isDisplayResource(
  location: Location,
  action: MessageData<"bus_display">,
  likedPlaylistID?: number
) {
  switch (action.type) {
    case "playlist": {
      if (location.pathname !== RoutePathMain.playlist.base) return false;
      const current = RoutePathMain.playlist.parseQuery(location, false);
      if (current.source === "like" && action.source === "like") return true;
      const currentID = current.source === "like" ? likedPlaylistID : Number(current.id);
      const targetID = action.source === "like" ? likedPlaylistID || action.id : action.id;
      return !!currentID && currentID === targetID;
    }
    case "album":
    case "artist": {
      const path = RoutePathMain[action.type];
      if (location.pathname !== path) return false;
      const { id } = RoutePath.parseQuery<{ id: number }>(location, path);
      return Number(id) === action.id;
    }
    case "history":
    case "star":
      return location.pathname === RoutePathMain[action.type];
    default:
      return false;
  }
}

/** 多窗口页面跳转动作 */
export function useDisplayAction(
  data: Nullable<MessageData<"bus_display">> | NormalFunc<[], Nullable<MessageData<"bus_display">>>
) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useLatestRef(location);
  const likedPlaylistID = useUser()?.likedPlaylist.id;
  const likedPlaylistIDRef = useLatestRef(likedPlaylistID);
  const dataRef = useLatestRef(data);
  const leavingRef = useRef<
    Nullable<{
      key: string;
      action: MessageData<"bus_display">;
    }>
  >(null);

  const back = useCallback(() => {
    if (window.history.state?.idx === 0) {
      leavingRef.current = null;
      navigate(RoutePathMain.home, { replace: true });
    } else {
      navigate(-1);
    }
  }, [navigate]);

  useEffect(() => {
    const leaving = leavingRef.current;
    if (!leaving || leaving.key === location.key) return;
    if (!isDisplayResource(location, leaving.action, likedPlaylistID)) {
      leavingRef.current = null;
      return;
    }
    leaving.key = location.key;
    back();
  }, [back, likedPlaylistID, location]);

  const onPageAction = useCallback(async () => {
    const data = typeof dataRef.current === "function" ? dataRef.current() : dataRef.current;
    if (!data) return;
    await RendererWindow.display.reactReadyAwait();
    RendererIPCMessageBus.display.deliver(data);
    const current = locationRef.current;
    leavingRef.current = isDisplayResource(current, data, likedPlaylistIDRef.current)
      ? { action: data, key: current.key }
      : null;
    back();
  }, [back, dataRef, likedPlaylistIDRef, locationRef]);

  return {
    onPageAction
  };
}
