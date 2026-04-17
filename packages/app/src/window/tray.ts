import { Log } from "../utils/log";
import { AppWindowManager } from "./manager";
import { isLinux } from "../utils/platform";
import { appLogoPath } from "../utils/path";
import {
  BrowserWindow,
  clipboard,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  nativeImage,
  screen,
  Tray
} from "electron";
import { AppMessageIPC } from "../ipc/main/typed";
import { AppWindowCreator } from "./manager";
import { AppWindows } from "./wins";

export class AppTray {
  static register() {
    Log.debug("registerTray");
    if (!AppWindowManager.getTray()) {
      this.createMenu(AppWindowManager.initTray(this.createIcon()));
    }
  }

  private static playerBus: Nullable<MessageTypeMap["playerBus"]> = null;

  private static createIcon() {
    return nativeImage.createFromPath(appLogoPath);
  }

  private static createMenu(tray: Tray) {
    if (isLinux) {
      this.showRawMenu(tray);
      AppMessageIPC.listenSelf("playerBus", (data) => {
        this.playerBus = data;
        this.showRawMenu(tray);
      });
    } else {
      const trayWin =
        AppWindowManager.get("tray") || AppWindowCreator.create(AppWindows.trayOnWindows);
      tray.addListener("click", () => {
        Log.debug("tray", "click");
        AppWindowManager.checkAndShow("main");
      });
      tray.addListener("double-click", () => {
        Log.debug("tray", "double-click");
        AppWindowManager.checkAndShow("main");
      });
      tray.addListener("right-click", () => {
        Log.debug("tray", "right-click");
        this.showCustomMenu(tray, trayWin);
      });
      trayWin.addListener("blur", () => {
        if (!trayWin.webContents.isDevToolsOpened()) {
          trayWin.isVisible() && trayWin.hide();
        }
      });
      trayWin.webContents.addListener("before-input-event", (_, input) => {
        if (input.key === "Escape") trayWin.hide();
      });
    }

    tray.setToolTip(process.env.APP_NAME);
    AppMessageIPC.listenSelf("playerBus", (data) => {
      const track = data.track?.detail;
      track?.name
        ? tray.setToolTip(`${process.env.APP_NAME} - ${track.name}`)
        : tray.setToolTip(process.env.APP_NAME);
    });
  }

  private static showRawMenu(tray: Tray) {
    Log.debug("tray", "create raw menu");
    const items: (MenuItem | MenuItemConstructorOptions)[] = [
      {
        label: this.playerBus?.status === "playing" ? "暂停" : "播放",
        click: () => {
          AppMessageIPC.send({
            sender: "process",
            receiver: "main",
            type: "playerActionBus",
            data: this.playerBus?.status === "playing" ? "pause" : "play"
          });
          this.showRawMenu(tray);
        }
      },
      {
        label: "上一首",
        click: () => {
          AppMessageIPC.send({
            sender: "process",
            receiver: "main",
            type: "playerActionBus",
            data: "previous"
          });
        }
      },
      {
        label: "下一首",
        click: () => {
          AppMessageIPC.send({
            sender: "process",
            receiver: "main",
            type: "playerActionBus",
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
              if (!this.playerBus) return;
              setTimeout(() => {
                if (!this.playerBus) return;
                //todo
              }, 3000);
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
            AppWindowManager.checkAndShow("main");
          }
        },
        {
          label: "退出",
          click: () => {
            AppMessageIPC.send({
              sender: "process",
              receiver: "main",
              type: "playerActionBus",
              data: "exit"
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
