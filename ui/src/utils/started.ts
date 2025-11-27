import { EqError, Log } from "@mahiru/ui/utils/dev";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { isAccountLoggedIn } from "@mahiru/ui/api/utils/auth";
import {
  refreshCookieTask,
  refreshUserProfile,
  refreshUserPlaylist,
  refreshUserLikedTrackIDs
} from "@mahiru/ui/utils/task";

export function started() {
  void onChangeDay([refreshCookieTask]);
  void onStarted([refreshUserProfile, refreshUserPlaylist, refreshUserLikedTrackIDs]);
}

async function onChangeDay(task: NormalFunc<never[], Promise<void>>[]) {
  const store = usePersistZustandStore.getState();
  const lastDate = store.data.lastRefreshCookieDate;
  if (
    isAccountLoggedIn() &&
    (typeof lastDate === "undefined" || lastDate !== new Date().getDate())
  ) {
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
