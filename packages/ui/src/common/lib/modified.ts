import { userStoreSnapshot } from "@/common/store/user";
import { NeteaseServicesUser, NeteaseServicesPlaylist } from "@/common/netease/services";
import type { NavigateFunction } from "react-router-dom";
import type { NeteaseUserModel } from "@/common/netease/models";

/** 用来集中处理资源修改时需要的重载 */
export class RendererModified {
  private static updaters = new Map<string, NormalFunc>();

  private static buildKey(props: ModifiedType) {
    switch (props.type) {
      case "playlist":
        return `playlist:id=${String(props.id)}&source=${props.source}`;
      case "userPlaylist":
        return `user:${props.user.userId}`;
      case "removePlaylist":
        return `remove:${props.id}`;
    }
  }

  static listen(props: ModifiedType, updater: NormalFunc) {
    const id = RendererModified.buildKey(props);
    RendererModified.updaters.set(id, updater);
    return () => {
      RendererModified.updaters.delete(id);
    };
  }

  static mark(props: ModifiedType) {
    queueMicrotask(async () => {
      switch (props.type) {
        case "playlist":
          if (props.source === "normal") {
            NeteaseServicesPlaylist.invalidate(Number(props.id));
          } else if (props.source === "like") {
            const id = userStoreSnapshot()._user?.likedPlaylist.id;
            id && NeteaseServicesPlaylist.invalidate(id);
          }
          break;
        case "userPlaylist":
          await NeteaseServicesUser.refreshUserPlaylist(props.user);
          break;
        case "removePlaylist":
          await props.navigate(props.homePath, { replace: true });
      }
      RendererModified.updaters.get(this.buildKey(props))?.();
    });
  }
}

export type ModifiedType =
  | {
      type: "userPlaylist";
      user: NeteaseUserModel;
    }
  | {
      type: "playlist";
      id: Nullable<number | string>;
      source: Nullable<"like" | "normal">;
    }
  | {
      homePath: string;
      type: "removePlaylist";
      navigate: NavigateFunction;
      id: Nullable<number | string>;
    };
