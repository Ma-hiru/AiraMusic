import { Auth } from "@mahiru/ui/public/entry/auth";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import { API } from "@mahiru/ui/public/api";
import { AddLocalStore, WithLocalStore } from "@mahiru/ui/public/store/local";
import { AddPlayerStore, WithPlayerStore } from "@mahiru/ui/main/store/player";
import { Time } from "@mahiru/ui/public/entry/time";

@AddLocalStore
@AddPlayerStore
class TaskClass {
  private done = false;

  private execTask(task: NormalFunc<never[], Promise<void>>[]) {
    return new Promise<void>((resolve) => {
      const total = task.length;
      if (total === 0) return resolve();
      let completed = 0;
      for (const func of task) {
        func()
          .then(() => {
            Log.trace("task", func.name + " finished");
          })
          .catch((error) => {
            Log.error(
              new EqError({
                label: "task",
                message: "task run failed: " + func.name,
                raw: error
              })
            );
          })
          .finally(() => {
            completed++;
            completed >= total && resolve();
          });
      }
    });
  }

  private onChangeDay(task: NormalFunc<never[], Promise<void>>[]) {
    if (Time.isChangeDay()) {
      Log.trace("start daily task");
      return this.execTask(task);
    }
    return Promise.resolve();
  }

  private onStarted(task: NormalFunc<never[], Promise<void>>[]) {
    Log.trace("start started task");
    return this.execTask(task);
  }

  public startTaskOnce() {
    if (this.done) return;
    // 仅在主窗口执行这些任务
    if (window.location.pathname !== "/") return (this.done = true);

    Promise.allSettled([
      this.onChangeDay([this.refreshCookies]),
      this.onStarted([this.refreshProfile, this.refreshUserPlaylist])
    ])
      .catch((err) => {
        Log.error(
          new EqError({
            label: "task.ts",
            message: "startTaskOnce failed",
            raw: err
          })
        );
      })
      .finally(() => (this.done = true));
  }

  /** 登录状态下，只包含歌单的id、描述、封面 */
  refreshUserPlaylist = async () => {
    try {
      if (!Auth.isAccountLoggedIn()) return;
      Log.trace("refresh user playlist");
      const { UserProfile } = this.localSnapshot.User;
      const {
        UpdateUserLikedListSummary,
        UpdateUserPlaylistSummary,
        UpdateUserFavoriteListsSummary
      } = this.playerSnapshot;
      const uid = UserProfile?.userId;
      if (uid) {
        const { playlist } = await API.User.userPlaylist({ uid, limit: 30 });
        const userPlaylist: NeteasePlaylistSummary[] = [];
        const userFavoriteLists: NeteasePlaylistSummary[] = [];
        const userLikedList = playlist.shift();

        playlist.forEach((item) => {
          if (item.creator.userId === uid) {
            userPlaylist.push(item);
          } else {
            userFavoriteLists.push(item);
          }
        });

        UpdateUserLikedListSummary(userLikedList || null);
        UpdateUserFavoriteListsSummary(userFavoriteLists);
        UpdateUserPlaylistSummary(userPlaylist);
        this.localProxy.User.UserLikedPlaylistID = userLikedList?.id || null;
      }
    } catch (err) {
      Log.error(
        new EqError({
          label: "task.ts",
          message: "refresh user playlist failed",
          raw: err
        })
      );
    }
  };

  refreshProfile = async () => {
    return await Auth.refreshProfile();
  };

  refreshCookies = async () => {
    return await Auth.refreshCookies();
  };
}

interface TaskClass extends WithLocalStore, WithPlayerStore {}

export const Task = new TaskClass();
