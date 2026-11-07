import { app, dialog, BrowserWindow } from "electron";
import { MainHandle } from "@/lib/handle";
import { MainRuntime } from "@/lib/runtime";
import { getDeviceName } from "@/utils/device";
import { fetchFromNode } from "@/lib/net-fetch";
import { MainAgentGuard } from "@/lib/agent/guard";
import { mergeCacheStoreConfig } from "@/utils/merge";
import { MainAgentContext } from "@/lib/agent/context";
import { getNetworkStatus } from "@/lib/network-status";
import { MainWindowManager } from "@/lib/window-manager";
import { MainScreenResolver } from "@/lib/screen-resolver";
import { MainCacheStoreConstants } from "@/constants/store";
import { MainStoreForConfig, MainStoreForRenderer } from "@/lib/key-value-store";
import { Log, exportLogFiles, getLogFileNames, runWithLogContext } from "@/lib/log";
import Fs from "node:fs/promises";
import type { InvokeHandlers } from "@mahiru/ipc/types";

export const invokeHandlers: InvokeHandlers = {
  invoke_net_fetch: (_event, request) => fetchFromNode(request),
  invoke_agent_feature_settings_get: (event) =>
    MainAgentGuard.callSync(event, "settings", () => getAgent().getState()),
  invoke_agent_feature_settings_update: (event, options) =>
    MainAgentGuard.call(event, "settings", () => getAgent().updateSettings(options)),
  invoke_agent_connection: (event) =>
    MainAgentGuard.call(event, "agent", () => getAgent().getConnection()),
  invoke_agent_context: (event) =>
    MainAgentGuard.callSync(event, "agent", () => MainAgentContext.snapshot()),
  invoke_fs_select: async (_, type) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: type === "dir" ? "选择目录" : "选择文件",
      properties: [type === "dir" ? "openDirectory" : "openFile"]
    });
    if (canceled) return { ok: false, path: "", canceled: true };
    const filePath = filePaths[0];
    if (!filePath) return { ok: false, path: "", error: "无效路径" };
    try {
      const status = await Fs.stat(filePath);
      if (type === "dir" && status.isFile()) {
        return {
          ok: false,
          path: "",
          error: "非目录路径"
        };
      }
      if (type === "file" && status.isDirectory()) {
        return {
          ok: false,
          path: "",
          error: "非文件路径"
        };
      }
      return {
        ok: true,
        path: filePath
      };
    } catch {
      return {
        ok: false,
        path: "",
        error: "路径不存在"
      };
    }
  },
  invoke_fs_save: async (_, { name, buffer }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "保存文件",
      defaultPath: name
    });
    if (canceled) return { ok: false, canceled: true };
    if (!filePath) return { ok: false, error: "无效路径" };
    try {
      await Fs.writeFile(filePath, Buffer.from(buffer));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },
  invoke_log_export: async (event, scope) => {
    try {
      if (scope !== "recent" && scope !== "all") return { ok: false, error: "无效日志范围" };
      const files = await getLogFileNames(scope);
      if (!files.length) return { ok: false, error: "暂无日志可导出" };
      const options = {
        title: "导出日志",
        defaultPath: `${process.env.APP_NAME}-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz`,
        filters: [{ name: "日志归档", extensions: ["gz"] }]
      };
      const sender = BrowserWindow.fromWebContents(event.sender);
      const { canceled, filePath } = sender
        ? await dialog.showSaveDialog(sender, options)
        : await dialog.showSaveDialog(options);
      if (canceled) return { ok: false, canceled: true };
      if (!filePath) return { ok: false, error: "无效路径" };
      await exportLogFiles(files, filePath);
      return { ok: true };
    } catch (error) {
      Log.error("invoke(log export)", error);
      return { ok: false, error: String(error) };
    }
  },
  invoke_device_gpu: async () => app.whenReady().then(() => app.getGPUInfo("complete")),
  invoke_device_platform: () => process.platform,
  invoke_device_net: () => getNetworkStatus(),
  invoke_device_name: () => getDeviceName(),
  invoke_window_id: (e) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    return MainWindowManager.getId(sender)!;
  },
  invoke_window_shown: (e, type) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return MainWindowManager.get(type)?.isVisible() ?? false;
  },
  invoke_window_pinned: (e, type) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return MainWindowManager.get(type)?.isAlwaysOnTop() ?? false;
  },
  invoke_window_bounds: (e) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      workAreaHeight: MainScreenResolver.primary.effectiveWorkAreaSize.height,
      workAreaWidth: MainScreenResolver.primary.effectiveWorkAreaSize.width,
      ...(sender?.getBounds() ?? {})
    };
  },
  invoke_window_maximized: (_, type) => {
    return MainWindowManager.get(type)?.isMaximized() ?? false;
  },
  invoke_window_opened: (e, win) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return MainWindowManager.has(win);
  },
  invoke_window_fullscreen: (e, type) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    if (!sender) return false;
    return MainWindowManager.get(type)?.isFullScreen() ?? false;
  },
  invoke_runtime_id: () => MainRuntime.id,
  invoke_runtime_token: () => MainRuntime.storeAccessToken,
  invoke_cache_config_update: (e, config) => {
    try {
      const res = mergeCacheStoreConfig(config);
      if (res.ok) {
        MainStoreForConfig.set("cache", res.config);
        MainHandle.allowedPath = res.config.path;
      }
      return res;
    } catch (err) {
      Log.error("invoke(updateCacheStoreConfig)", err);
      return { ok: false, reason: "配置修改错误" };
    }
  },
  invoke_cache_config_get: () => {
    return MainStoreForConfig.get("cache", MainCacheStoreConstants.DEFAULT_CONFIG);
  },
  invoke_store_set: (_, { key, value }) => {
    try {
      MainStoreForRenderer.set(key, value);
      return { ok: true };
    } catch (err) {
      Log.error(err);
      return { ok: false, reason: "本地数据错误" };
    }
  },
  invoke_store_get: (_, key) => {
    try {
      const value = MainStoreForRenderer.get(key);
      return {
        ok: true,
        value
      };
    } catch (err) {
      Log.error(err);
      return { ok: false, reason: "本地数据错误" };
    }
  },
  invoke_store_delete: (_, key) => {
    try {
      MainStoreForRenderer.delete(key);
      return { ok: true };
    } catch (err) {
      Log.error(err);
      return { ok: false, reason: "本地数据错误" };
    }
  }
};

for (const [key, handler] of Object.entries(invokeHandlers)) {
  invokeHandlers[key as keyof typeof invokeHandlers] = ((...args: any[]) => {
    return runWithLogContext({ traceId: `${key}:${crypto.randomUUID()}` }, () => handler(...args));
  }) as never;
}

function getAgent() {
  const agent = MainHandle.get()?.agent;
  if (!agent) throw new Error("Agent 功能尚未初始化");
  return agent;
}
