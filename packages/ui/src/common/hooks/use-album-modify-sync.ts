import { useCallback } from "react";
import { RendererIPCMessageBus } from "@/common/lib/bus";

export type AlbumModifyType = "star";

export function useAlbumModifySync(id: Nullable<number>) {
  const onEdited = useCallback(
    (modifies: AlbumModifyType[]) => {
      for (const m of modifies) {
        switch (m) {
          case "star":
            RendererIPCMessageBus.modified.deliver({ type: "album", id });
        }
      }
    },
    [id]
  );

  return {
    onEdited
  };
}
