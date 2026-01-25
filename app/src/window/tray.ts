import {
  nativeImage,
  screen,
  clipboard,
  Tray,
  BrowserWindow,
  Menu,
  MenuItem,
  MenuItemConstructorOptions
} from "electron";
import { WindowExits, WindowManager } from "./manager";
import { preloadPath, staticAssetsDir } from "../utils/path";
import { join } from "node:path";
import { isLinux, isWindows } from "../utils/platform";
import { Log } from "../utils/log";
import { getEffectiveWindowSize } from "../utils/screen";
import { isDev } from "../utils/dev";
import { EqError } from "../utils/err";
import { addIpcMainReceiveMessageHandler, typedIpcMainSendMessage } from "../ipc/main/typed";
import { CreateInfoWindow } from "./info";

export function registerTray() {
  Log.debug("registerTray");
  if (!WindowManager.getTray()) {
    createTray();
  }
}

function createTray() {
  const icon = createIcon();
  const trayWin = createTrayWin();
  const tray = WindowManager.initTray(icon);
  tray.setToolTip("music");
  createMenu(tray, trayWin);
}

function createIcon() {
  let iconPath;
  if (isLinux || isWindows) {
    iconPath = join(staticAssetsDir, "tray", "netease.png");
  } else {
    iconPath = join(staticAssetsDir, "tray", "netease.png");
  }
  return nativeImage.createFromPath(iconPath);
}

function createTrayWin() {
  if (isLinux) return null;
  if (WindowManager.get("tray")) return WindowManager.get("tray")!;
  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.4, 0.4);
  const TrayWindow = WindowManager.createBrowserWindow(
    {
      width: effectiveWidth,
      height: effectiveHeight,
      webPreferences: {
        preload: preloadPath
      },
      alwaysOnTop: true,
      title: "tray",
      resizable: false,
      minimizable: false,
      maximizable: false,
      titleBarStyle: "hidden",
      frame: false,
      type: "toolbar",
      skipTaskbar: true,
      show: false
    },
    "tray",
    WindowExits.IGNORE
  );

  TrayWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  loadTrayWindowURL(
    TrayWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );

  return TrayWindow;
}

function createMenu(tray: Tray, trayWin: Optional<BrowserWindow>) {
  if (isLinux) {
    setRawMenu(tray);
    addIpcMainReceiveMessageHandler("playerTrackSync", (sync) => {
      trackSync = sync;
      setRawMenu(tray);
    });
    addIpcMainReceiveMessageHandler("playerStatusSync", (sync) => {
      statusSync = sync;
      setRawMenu(tray);
    });
  } else {
    if (!trayWin) return;
    tray.on("click", () => {
      Log.trace("tray", "click");
      const mainWin = WindowManager.get("main");
      if (!mainWin) return;
      mainWin.isVisible() ? mainWin.focus() : mainWin.show();
    });
    tray.on("right-click", () => {
      Log.trace("tray", "right-click");
      setTrayWin(tray, trayWin);
    });
    trayWin.on("blur", () => {
      if (!trayWin.webContents.isDevToolsOpened()) {
        trayWin.isVisible() && trayWin.hide();
      }
    });
    trayWin.webContents.on("before-input-event", (_, input) => {
      if (input.key === "Escape") trayWin.hide();
    });
    addIpcMainReceiveMessageHandler("playerTrackSync", ({ track }) => {
      tray.setToolTip(track.name + track.ar.map((a) => a.name).join("&"));
    });
  }
}

function loadTrayWindowURL(trayWindow: Electron.BrowserWindow, port: string | number) {
  trayWindow.loadURL(`http://localhost:${port}/tray.html`).catch((err) => {
    Log.error(
      new EqError({
        raw: err,
        message: `failed to load tray window URL: http://localhost:${port}/tray`,
        label: "app/window/tray.ts"
      })
    );
  });
}

let trackSync: Nullable<PlayerTrackStatus> = null;
let statusSync: Nullable<PlayerStatusSync> = null;
function setRawMenu(tray: Tray) {
  Log.trace("tray", "create menu");
  const items: (MenuItem | MenuItemConstructorOptions)[] = [
    {
      label: statusSync?.fsmState === 4 ? "暂停" : "播放",
      click: () => {
        if (statusSync?.fsmState === 4) {
          typedIpcMainSendMessage({
            sender: "main",
            receiver: "main",
            type: "playerControl",
            data: "pause"
          });
        } else {
          typedIpcMainSendMessage({
            sender: "main",
            receiver: "main",
            type: "playerControl",
            data: "play"
          });
        }
        setRawMenu(tray);
      }
    },
    {
      label: "上一首",
      click: () => {
        typedIpcMainSendMessage({
          sender: "main",
          receiver: "main",
          type: "playerControl",
          data: "last"
        });
      }
    },
    {
      label: "下一首",
      click: () => {
        typedIpcMainSendMessage({
          sender: "main",
          receiver: "main",
          type: "playerControl",
          data: "next"
        });
      }
    }
  ];
  if (trackSync) {
    items.push(
      ...[
        {
          label: "评论",
          click: () => {
            if (!trackSync) return;
            CreateInfoWindow();
            setTimeout(() => {
              if (!trackSync) return;
              typedIpcMainSendMessage({
                sender: "main",
                receiver: "info",
                type: "infoSync",
                data: {
                  type: "comments",
                  value: {
                    type: 0,
                    id: trackSync.track.id,
                    track: trackSync.track
                  }
                }
              });
            }, 3000);
          }
        },
        {
          label: "复制",
          submenu: [
            {
              label: "复制歌名",
              click: () => {
                trackSync && clipboard.writeText(trackSync.track.name);
              }
            },
            {
              label: "复制歌手名",
              click: () => {
                trackSync && clipboard.writeText(trackSync.track.ar.map((a) => a.name).join("&"));
              }
            },
            {
              label: "复制专辑名",
              click: () => {
                trackSync && clipboard.writeText(trackSync.track.al.name);
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
          WindowManager.checkAndShow("main");
        }
      },
      {
        label: "退出",
        click: () => {
          typedIpcMainSendMessage({
            sender: "main",
            receiver: "main",
            type: "playerControl",
            data: "exit"
          });
        }
      }
    ]
  );
  const menu = Menu.buildFromTemplate(items);

  tray.setContextMenu(menu);
}

function setTrayWin(tray: Tray, trayWin: BrowserWindow) {
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
