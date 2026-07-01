import { debounce } from "lodash-es";
import {
  Menu,
  Tray,
  screen,
  MenuItem,
  clipboard,
  nativeImage,
  BrowserWindow,
  type MenuItemConstructorOptions
} from "electron";
import { Log } from "@/lib/log";
import { MainHandle } from "@/lib/handle";
import { MainIPC } from "@mahiru/ipc/main";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowConstants } from "@/constants/window";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowManager } from "@/lib/window-manager";
import { MainExitCodeConstants } from "@/constants/exit-code";
import type { MessageData } from "@mahiru/ipc/types";

export class MainTray {
  static register() {
    Log.debug("registerTray");
    if (!MainWindowManager.getTray()) {
      this.createMenu(MainWindowManager.initTray(this.createIcon()));
    }
  }

  private static playerBus: Nullable<MessageData<"bus_deliver_track_meta">> = null;
  private static customMenuVisible = false;

  private static createIcon() {
    return nativeImage.createFromPath(MainPathResolver.appLogoPath);
  }

  private static hideCustomMenu(trayWin: BrowserWindow) {
    if (!this.customMenuVisible) return;

    this.customMenuVisible = false;
    trayWin.setIgnoreMouseEvents(true);
    trayWin.setOpacity(0);
    trayWin.setPosition(
      MainWindowConstants.TRAY_HIDDEN_POINT.x,
      MainWindowConstants.TRAY_HIDDEN_POINT.y,
      false
    );
    trayWin.isFocused() && trayWin.blur();
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
      const showMenu = () => this.showCustomMenu(tray, trayWin);
      const showMenuDebounced = debounce(showMenu, 300);
      tray.addListener("click", () => {
        Log.debug("tray", "click");
        showMenuDebounced();
      });
      tray.addListener("double-click", () => {
        Log.debug("tray", "double-click");
        showMenuDebounced.cancel();
        MainWindowManager.checkAndShow("main");
        MainWindowManager.get("miniplayer")?.hide();
      });
      tray.addListener("right-click", () => {
        Log.debug("tray", "right-click");
        showMenuDebounced.cancel();
        showMenu();
      });
      trayWin.addListener("blur", () => {
        if (!trayWin.webContents.isDevToolsOpened()) {
          this.hideCustomMenu(trayWin);
        }
      });
      trayWin.webContents.addListener("before-input-event", (_, input) => {
        if (input.key === "Escape") this.hideCustomMenu(trayWin);
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

    if (!this.customMenuVisible) trayWin.setOpacity(0);
    trayWin.setIgnoreMouseEvents(false);
    trayWin.setPosition(x, y, false);
    if (!trayWin.isVisible()) trayWin.show();
    trayWin.focus();
    trayWin.setOpacity(1);
    this.customMenuVisible = true;
  }
}
