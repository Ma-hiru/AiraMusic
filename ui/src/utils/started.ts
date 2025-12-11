import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Auth } from "@mahiru/ui/utils/auth";
import {
  loadHistoryListFromPersistentStore,
  refreshCookieTask,
  refreshUserLikedTrackIDs,
  refreshUserPlaylist,
  refreshUserProfile
} from "@mahiru/ui/utils/task";
import { Time } from "@mahiru/ui/utils/time";

export function started() {
  // 仅在主窗口执行这些任务
  if (window.location.pathname !== "/") return;
  void onChangeDay([refreshCookieTask]);
  void onStarted([
    refreshUserProfile,
    refreshUserPlaylist,
    refreshUserLikedTrackIDs,
    loadHistoryListFromPersistentStore
  ]);
}

async function onChangeDay(task: NormalFunc<never[], Promise<void>>[]) {
  if (Auth.isAccountLoggedIn() && Time.isChangeDay()) {
    Log.trace("start daily task");
    for (const func of task) {
      try {
        await func();
        Log.trace(func.name + " finished");
      } catch (error) {
        Log.error(
          new EqError({
            label: "ui/common.ts:dailyTask",
            message: "task run failed: " + func.name,
            raw: error
          })
        );
      }
    }
  }
}

async function onStarted(task: NormalFunc<never[], Promise<void>>[]) {
  Log.trace("start started task");
  for (const func of task) {
    try {
      await func();
      Log.trace(func.name + " finished");
    } catch (error) {
      Log.error(
        new EqError({
          label: "ui/common.ts:startedTask",
          message: "task run failed: " + func.name,
          raw: error
        })
      );
    }
  }
}
