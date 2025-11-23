import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { isAccountLoggedIn } from "@mahiru/ui/api/utils/auth";
import {
  refreshCookieTask,
  refreshLikedListDetailString,
  refreshUserProfile
} from "@mahiru/ui/utils/task";
import { isDev } from "@mahiru/ui/utils/dev";

export function startedTask() {
  if (isDev) {
    void onlyChangeDay([refreshCookieTask, refreshUserProfile, refreshLikedListDetailString]);
  } else {
    void onlyChangeDay([refreshCookieTask]);
    void onStartedTask([refreshUserProfile, refreshLikedListDetailString]);
  }
}

async function onlyChangeDay(task: NormalFunc<never[], Promise<void>>[]) {
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

async function onStartedTask(task: NormalFunc<never[], Promise<void>>[]) {
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
