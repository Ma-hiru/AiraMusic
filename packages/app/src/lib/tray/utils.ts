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
  /** darwin 的胶囊由原生承载，没有 Electron Tray 实例 */
  constructor(tray: Nullable<Tray>) {
    if (!tray) return;
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
    tray: Nullable<Tray>,
    trayWin: BrowserWindow,
    /** native 歌词条传来的是 AppKit 屏幕坐标（左下原点）+ 该屏的 CGDirectDisplayID */
    anchor?: MenuBarAnchor
  ) {
    const winBounds = trayWin.getBounds();
    let x: number;
    let y: number;

    if (anchor) {
      // 菜单栏歌词：水平对齐歌词条；垂直贴在该屏 workArea 顶边（菜单栏正下方）
      const { workArea } = resolveDisplay(anchor);
      const trayCenterX = anchor.x + anchor.width / 2;
      x = Math.round(trayCenterX - winBounds.width / 2);
      if (x + winBounds.width > workArea.x + workArea.width) {
        x = workArea.x + workArea.width - winBounds.width - 8;
      }
      if (x < workArea.x) x = workArea.x + 8;
      y = Math.round(workArea.y);
    } else {
      const trayBounds = tray?.getBounds();
      if (!trayBounds) {
        Log.warn("tray", "custom menu requires either anchor or tray bounds");
        return;
      }
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

    MainWindowManager.deliverIPCEvent(trayWin, "show");
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
    MainWindowManager.deliverIPCEvent(trayWin, "hide");
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
    const copy = (text: string) => {
      clipboard.writeText(text).catch((err) => {
        Log.error("tray", "copy", err);
      });
    };
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
                  playerBus?.track && copy(playerBus.track.name);
                }
              },
              {
                label: "复制歌手名",
                click: () => {
                  playerBus?.track?.detail &&
                    copy(playerBus.track.detail.ar.map((a) => a.name).join("&"));
                }
              },
              {
                label: "复制专辑名",
                click: () => {
                  playerBus?.track?.detail && copy(playerBus.track?.detail.al.name);
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
            const app = MainHandle.get();
            app?.exit(MainExitCodeConstants.NORMAL_EXIT, "");
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
                {
                  label: "关于 " + process.env.APP_NAME,
                  click: () => MainWindowCreator.create(MainWindowPreset.about)
                },
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

/** native 菜单栏事件带来的 AppKit 矩形（左下原点） */
type MenuBarAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** CGDirectDisplayID，与 Electron `display.id` 同源；0 表示没取到 */
  displayId?: number;
};

/**
 * @desc 定位胶囊所在的那块屏 \
 * 优先按 native 给的 displayId 精确匹配；缺失时把 AppKit 的左下原点坐标
 * 翻成 Electron 的左上原点矩形再匹配 \
 * 不能再用固定的 `y: 0`：上下叠屏时那条线正好是两屏交界，距离同为 0 会被判给主屏
 */
function resolveDisplay(anchor: MenuBarAnchor) {
  if (anchor.displayId) {
    const matched = screen.getAllDisplays().find((display) => display.id === anchor.displayId);
    if (matched) return matched;
  }

  const primaryHeight = screen.getPrimaryDisplay().bounds.height;
  return screen.getDisplayMatching({
    x: Math.round(anchor.x),
    y: Math.round(primaryHeight - anchor.y - anchor.height),
    width: Math.round(anchor.width),
    height: Math.round(anchor.height)
  });
}
