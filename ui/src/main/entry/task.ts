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
            Log.debug("task", func.name + " finished");
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
      Log.debug("start daily task");
      return this.execTask(task);
    }
    return Promise.resolve();
  }

  private onStarted(task: NormalFunc<never[], Promise<void>>[]) {
    Log.debug("start started task");
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




}

interface TaskClass extends WithLocalStore, WithPlayerStore {}

export const Task = new TaskClass();
