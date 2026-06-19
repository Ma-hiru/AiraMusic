import { MainIPC } from "@mahiru/ipc/main";
import {
  BrowserWindow,
  clipboard,
  Menu,
  MenuItem,
  type MenuItemConstructorOptions,
  nativeImage,
  screen,
  Tray
} from "electron";
import { MainWindowManager } from "@/lib/window-manager";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowCreator } from "@/lib/window-creator";
import { Log } from "@/lib/log";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainHandle } from "@/lib/handle";
import { MainExitCodeConstants } from "@/constants/exit-code";
import { debounce } from "lodash-es";
import type { MessageData } from "@mahiru/ipc/types";

export class MainTray {
  static register() {
    Log.debug("registerTray");
    if (!MainWindowManager.getTray()) {
      this.createMenu(MainWindowManager.initTray(this.createIcon()));
    }
  }

  private static playerBus: Nullable<MessageData<"bus_deliver_track_meta">> = null;

  private static createIcon() {
    return nativeImage.createFromPath(MainPathResolver.appLogoPath);
  }

  private static createMenu(tray: Tray) {
    if (process.platform === "linux") {
      this.showRawMenu(tray);
      MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
        this.playerBus = data;
        this.showRawMenu(tray);
      });
    } else {
      const trayWin =
        MainWindowManager.get("tray") || MainWindowCreator.create(MainWindowPreset.trayOnWindows)!;
      // 用于解决 Windows 上点击托盘图标时菜单闪烁的问题
      let ignoredBlur = false;
      const showMenu = debounce(() => {
        ignoredBlur = true;
        this.showCustomMenu(tray, trayWin);
        setTimeout(() => (ignoredBlur = false), 100);
      }, 300);
      tray.addListener("click", () => {
        Log.debug("tray", "click");
        showMenu();
      });
      tray.addListener("double-click", () => {
        Log.debug("tray", "double-click");
        MainWindowManager.checkAndShow("main");
        MainWindowManager.get("miniplayer")?.hide();
      });
      tray.addListener("right-click", () => {
        Log.debug("tray", "right-click");
        showMenu();
      });
      trayWin.addListener("blur", () => {
        if (ignoredBlur) return;
        if (!trayWin.webContents.isDevToolsOpened()) {
          trayWin.isVisible() && trayWin.hide();
        }
      });
      trayWin.webContents.addListener("before-input-event", (_, input) => {
        if (input.key === "Escape") trayWin.hide();
      });
    }

    tray.setToolTip(process.env.APP_NAME);
    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
      const track = data.track?.detail;
      track?.name
        ? tray.setToolTip(`${process.env.APP_NAME} - ${track.name}`)
        : tray.setToolTip(process.env.APP_NAME);
    });
  }

  private static removeChecker: Nullable<NormalFunc> = null;
  private static previousResolve: Nullable<NormalFunc> = null;
  private static previousTimer: Nullable<NodeJS.Timeout> = null;
  private static openCommentReady(promise?: Promise<void>, resolve?: NormalFunc) {
    if (!promise || !resolve) {
      const newPromise = Promise.withResolvers<void>();
      promise = newPromise.promise;
      resolve = newPromise.resolve;
    }

    const commentWin = MainWindowManager.get("comments");
    if (commentWin) {
      this.removeChecker?.();
      this.previousResolve?.();
      this.previousTimer && clearTimeout(this.previousTimer);

      this.previousResolve = resolve;
      this.previousTimer = setTimeout(() => {
        this.removeChecker?.();
        this.previousResolve?.();
        this.removeChecker = null;
        this.previousResolve = null;
        this.previousTimer = null;
      }, 5000);
      this.removeChecker = MainIPC.MessageChannel.addForwardChecker((win, message) => {
        if (
          MainWindowManager.getId(win) === "comments" &&
          message.type === "bus_deliver_react_ready" &&
          (message.data as MessageData<"bus_deliver_react_ready">).type === "ready"
        ) {
          this.previousTimer && clearTimeout(this.previousTimer);
          this.removeChecker?.();
          this.removeChecker = null;
          this.previousResolve = null;
          resolve();
        }
        return true;
      });

      MainIPC.MessageChannel.commit({
        sender: "process",
        receiver: "comments",
        type: "bus_deliver_react_ready",
        data: {
          type: "isReady",
          target: "comments"
        }
      });
    } else {
      MainWindowCreator.create(MainWindowPreset.get("comments"))?.once("ready-to-show", () =>
        this.openCommentReady(promise, resolve)
      );
    }

    return promise;
  }

  private static showRawMenu(tray: Tray) {
    Log.debug("tray", "create raw menu");
    const items: (MenuItem | MenuItemConstructorOptions)[] = [
      {
        label: this.playerBus?.status === "playing" ? "暂停" : "播放",
        click: () => {
          MainIPC.MessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "bus_dispatch_player_action",
            data: this.playerBus?.status === "playing" ? "pause" : "play"
          });
          this.showRawMenu(tray);
        }
      },
      {
        label: "上一首",
        click: () => {
          MainIPC.MessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "bus_dispatch_player_action",
            data: "previous"
          });
        }
      },
      {
        label: "下一首",
        click: () => {
          MainIPC.MessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "bus_dispatch_player_action",
            data: "next"
          });
        }
      }
    ];
    if (this.playerBus) {
      items.push(
        ...[
          {
            label: "评论",
            click: () => {
              const track = this.playerBus?.track;
              if (!track) return;
              this.openCommentReady().then(() => {
                MainIPC.MessageChannel.commit({
                  sender: "process",
                  receiver: "comments",
                  type: "bus_deliver_comment",
                  data: {
                    id: track.id,
                    type: "track"
                  }
                });
              });
            }
          },
          {
            label: "复制",
            submenu: [
              {
                label: "复制歌名",
                click: () => {
                  this.playerBus?.track && clipboard.writeText(this.playerBus.track.name);
                }
              },
              {
                label: "复制歌手名",
                click: () => {
                  this.playerBus?.track?.detail &&
                    clipboard.writeText(
                      this.playerBus.track.detail.ar.map((a) => a.name).join("&")
                    );
                }
              },
              {
                label: "复制专辑名",
                click: () => {
                  this.playerBus?.track?.detail &&
                    clipboard.writeText(this.playerBus.track?.detail.al.name);
                }
              }
            ]
          }
        ]
      );
    }
    items.push(
      ...[
        {
          label: "显示",
          click: () => {
            MainWindowManager.checkAndShow("main");
            MainWindowManager.get("miniplayer")?.hide();
          }
        },
        {
          label: "退出",
          click: () => {
            MainIPC.MessageChannel.commit({
              sender: "process",
              receiver: "main",
              type: "bus_dispatch_player_action",
              data: "exit"
            });
            setTimeout(() => {
              const app = MainHandle.get();
              app?.exit(MainExitCodeConstants.NORMAL_EXIT, "user exit");
            });
          }
        }
      ]
    );
    const menu = Menu.buildFromTemplate(items);

    tray.setContextMenu(menu);
  }

  private static showCustomMenu(tray: Tray, trayWin: BrowserWindow) {
    const trayBounds = tray.getBounds();
    const winBounds = trayWin.getBounds();
    const workArea = screen.getDisplayNearestPoint({
      x: trayBounds.x,
      y: trayBounds.y
    }).workArea;
    const trayCenterX = trayBounds.x + trayBounds.width / 2;
    const isTop = trayBounds.y < workArea.y + workArea.height / 2;

    let x = Math.round(trayCenterX - winBounds.width / 2); // 水平居中对齐
    if (x + winBounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - winBounds.width - 8;
    }
    if (x < workArea.x) {
      x = workArea.x + 8;
    }

    let y = isTop ? trayBounds.y + trayBounds.height + 4 : trayBounds.y - winBounds.height - 4;
    if (y + winBounds.height > workArea.y + workArea.height) {
      y = trayBounds.y - winBounds.height - 4;
    }
    if (y < workArea.y) {
      y = trayBounds.y + trayBounds.height + 4;
    }

    trayWin.setPosition(x, y, false);
    !trayWin.isVisible() && trayWin.show();
    trayWin.focus();
  }
}
