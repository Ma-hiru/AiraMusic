import { useCallback } from "react";
import { RendererIPCMessageBus } from "@/common/lib/bus";

export function usePlaylistModifySync(id: Nullable<string>, source: Nullable<"like" | "normal">) {
  const onEdited = useCallback(() => {
    RendererIPCMessageBus.modified.twoWay({ type: "user-playlist" });
    RendererIPCMessageBus.modified.twoWay({ type: "playlist-update", id, source });
  }, [id, source]);

  const onDeleted = useCallback(() => {
    RendererIPCMessageBus.modified.twoWay({ type: "user-playlist" });
    RendererIPCMessageBus.modified.twoWay({ type: "remove-playlist", id });
  }, [id]);

  return {
    onEdited,
    onDeleted
  };
}
