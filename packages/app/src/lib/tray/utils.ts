import {
  Menu,
  Tray,
  screen,
  MenuItem,
  clipboard,
  BrowserWindow,
  type MenuItemConstructorOptions
} from "electron";
import { Log } from "@/lib/log";
import { MainHandle } from "@/lib/handle";
import { MainIPC } from "@mahiru/ipc/main";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowConstants } from "@/constants/window";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowManager } from "@/lib/window-manager";
import { MainExitCodeConstants } from "@/constants/exit-code";
import type { MessageData } from "@mahiru/ipc/types";

export class TrayUtils {
  constructor(tray: Tray) {
    tray.setToolTip(process.env.APP_NAME);
    MainIPC.MessageChannel.listen("bus_deliver_track_meta", (data) => {
      const track = data.track?.detail;
      track?.name
        ? tray.setToolTip(`${process.env.APP_NAME} - ${track.name}`)
        : tray.setToolTip(process.env.APP_NAME);
    });
  }

  protected customMenuVisible = false;
  protected showCustomMenu(
    tray: Tray,
    trayWin: BrowserWindow,
    /** native 歌词条传来的是 AppKit 屏幕坐标（左下原点） */
    anchor?: { x: number; y: number; width: number; height: number }
  ) {
    const winBounds = trayWin.getBounds();
    let x: number;
    let y: number;

    if (anchor) {
      // 菜单栏歌词：水平对齐歌词条；垂直贴在该屏 workArea 顶边（菜单栏正下方）
      // 避免 AppKit ↔ Electron Y 轴混用导致飞位
      const display = screen.getDisplayNearestPoint({ x: Math.round(anchor.x), y: 0 });
      const { workArea } = display;
      const trayCenterX = anchor.x + anchor.width / 2;
      x = Math.round(trayCenterX - winBounds.width / 2);
      if (x + winBounds.width > workArea.x + workArea.width) {
        x = workArea.x + workArea.width - winBounds.width - 8;
      }
      if (x < workArea.x) x = workArea.x + 8;
      y = Math.round(workArea.y);
    } else {
      const trayBounds = tray.getBounds();
      const workArea = screen.getDisplayNearestPoint({
        x: trayBounds.x,
        y: trayBounds.y
      }).workArea;
      const trayCenterX = trayBounds.x + trayBounds.width / 2;
      const isTop = trayBounds.y < workArea.y + workArea.height / 2;
      x = Math.round(trayCenterX - winBounds.width / 2);
      if (x + winBounds.width > workArea.x + workArea.width) {
        x = workArea.x + workArea.width - winBounds.width - 8;
      }
      if (x < workArea.x) x = workArea.x + 8;
      y = isTop ? trayBounds.y + trayBounds.height + 4 : trayBounds.y - winBounds.height - 4;
      if (y + winBounds.height > workArea.y + workArea.height) {
        y = trayBounds.y - winBounds.height - 4;
      }
      if (y < workArea.y) y = trayBounds.y + trayBounds.height + 4;
    }

    if (!this.customMenuVisible) trayWin.setOpacity(0);
    trayWin.setIgnoreMouseEvents(false);
    trayWin.setPosition(x, y, false);
    if (!trayWin.isVisible()) trayWin.show();
    trayWin.focus();
    trayWin.setOpacity(1);
    this.customMenuVisible = true;
  }
  protected hideCustomMenu(trayWin: BrowserWindow) {
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

  protected removeChecker: Nullable<NormalFunc> = null;
  protected previousResolve: Nullable<NormalFunc> = null;
  protected previousTimer: Nullable<NodeJS.Timeout> = null;
  protected openCommentReady(promise?: Promise<void>, resolve?: NormalFunc) {
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

  protected showRawMenu(register: {
    setMenu: NormalFunc<[menu: Menu]>;
    getData: NormalFunc<[], Nullable<MessageData<"bus_deliver_track_meta">>>;
  }) {
    Log.debug("tray", "create raw menu");
    const playerBus = register.getData();
    const items: (MenuItem | MenuItemConstructorOptions)[] = [
      {
        label: playerBus?.status === "playing" ? "暂停" : "播放",
        click: () => {
          MainIPC.MessageChannel.commit({
            sender: "process",
            receiver: "main",
            type: "bus_dispatch_player_action",
            data: playerBus?.status === "playing" ? "pause" : "play"
          });
          setTimeout(() => this.showRawMenu(register), 1000);
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
    if (playerBus) {
      items.push(
        ...[
          {
            label: "评论",
            click: () => {
              const track = playerBus?.track;
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
                  playerBus?.track && clipboard.writeText(playerBus.track.name);
                }
              },
              {
                label: "复制歌手名",
                click: () => {
                  playerBus?.track?.detail &&
                    clipboard.writeText(playerBus.track.detail.ar.map((a) => a.name).join("&"));
                }
              },
              {
                label: "复制专辑名",
                click: () => {
                  playerBus?.track?.detail && clipboard.writeText(playerBus.track?.detail.al.name);
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

    const template =
      process.platform === "darwin"
        ? <(MenuItem | MenuItemConstructorOptions)[]>[
            {
              label: process.env.APP_NAME,
              submenu: [
                { role: "about", label: "关于 " + process.env.APP_NAME },
                { type: "separator" },
                { role: "services", label: "服务" },
                { type: "separator" },
                { role: "hide", label: "隐藏 " + process.env.APP_NAME },
                { role: "hideOthers", label: "隐藏其他" },
                { role: "unhide", label: "显示全部" },
                { type: "separator" },
                { role: "quit", label: "退出 " + process.env.APP_NAME }
              ]
            },
            { label: "控制", submenu: items },
            {
              label: "编辑",
              submenu: [
                { role: "undo", label: "撤销" },
                { role: "redo", label: "重做" },
                { type: "separator" },
                { role: "cut", label: "剪切" },
                { role: "copy", label: "复制" },
                { role: "paste", label: "粘贴" },
                { role: "selectAll", label: "全选" }
              ]
            },
            {
              label: "窗口",
              submenu: [
                { role: "minimize", label: "最小化" },
                { role: "zoom", label: "缩放" },
                { type: "separator" },
                { role: "front", label: "前置全部窗口" }
              ]
            }
          ]
        : items;

    register.setMenu(Menu.buildFromTemplate(template));
  }
}
