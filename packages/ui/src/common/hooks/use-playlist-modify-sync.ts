import { useCallback } from "react";
import { RendererIPCMessageBus } from "@/common/lib/bus";

export type PlaylistModifyType = "meta" | "star";

export function usePlaylistModifySync(id: Nullable<string>, source: Nullable<"like" | "normal">) {
  const onEdited = useCallback(
    (modifies: PlaylistModifyType[]) => {
      for (const m of modifies) {
        switch (m) {
          case "meta":
            RendererIPCMessageBus.modified.twoWay({ type: "user-playlist" });
            RendererIPCMessageBus.modified.twoWay({ type: "playlist-update", id, source });
            break;
          case "star":
            RendererIPCMessageBus.modified.deliver({ type: "playlist-update", id, source });
            break;
        }
      }
    },
    [id, source]
  );

  const onDeleted = useCallback(() => {
    RendererIPCMessageBus.modified.twoWay({ type: "user-playlist" });
    RendererIPCMessageBus.modified.twoWay({ type: "remove-playlist", id });
  }, [id]);

  return {
    onEdited,
    onDeleted
  };
}
