import { app, dialog, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { Log } from "@/lib/log";
import { MainAgent } from "@/inner/agent";
import { MainHandle } from "@/lib/handle";
import { MainRuntime } from "@/lib/runtime";
import { mergeCacheStoreConfig } from "@/utils/merge";
import { MainWindowManager } from "@/lib/window-manager";
import { MainScreenResolver } from "@/lib/screen-resolver";
import { MainCacheStoreConstants } from "@/constants/store";
import { AIError, AIResult, type AIErrorCode } from "@mahiru/ai";
import { MainStoreForConfig, MainStoreForRenderer } from "@/lib/key-value-store";
import Net from "node:net";
import Https from "node:https";
import Fs from "node:fs/promises";
import Dns from "node:dns/promises";
import type { InvokeHandlers } from "@mahiru/ipc/types";

export const invokeHandlers: InvokeHandlers = {
  invoke_agent_list_providers: (event) => {
    return authorizedAgentData(event, () => MainAgent.listProviders());
  },
  invoke_agent_list_provider_descriptors: (event) => {
    return authorizedAgentData(event, () => MainAgent.listProviderDescriptors());
  },
  invoke_agent_list_configs: (event) => {
    return authorizedAgentResult(event, () => MainAgent.listConfigs());
  },
  invoke_agent_create_config: (event, options) => {
    return authorizedAgentResult(event, async () => {
      if (
        !isRecord(options) ||
        !hasOnlyKeys(options, ["name", "provider", "config"]) ||
        typeof options.name !== "string" ||
        typeof options.provider !== "string" ||
        !isRecord(options.config)
      ) {
        return AIResult.err({
          type: "invalid_config",
          message: "创建 Provider 配置的参数无效，且不允许指定 id"
        });
      }
      return MainAgent.createConfig({
        name: options.name,
        provider: options.provider,
        config: structuredClone(options.config)
      });
    });
  },
  invoke_agent_update_config: (event, options) => {
    return authorizedAgentResult(event, () => MainAgent.updateConfig(options));
  },
  invoke_agent_create_conversation: (event, options) => {
    return authorizedAgentResult(event, () => {
      if (
        options !== undefined &&
        (!isRecord(options) ||
          !hasOnlyKeys(options, ["name"]) ||
          (options.name !== undefined && typeof options.name !== "string"))
      ) {
        return AIResult.err({
          type: "invalid_conversation",
          message: "创建会话只允许传入可选的 name，不能指定 id 或消息快照"
        });
      }
      return MainAgent.createConversation(options ? { name: options.name } : {});
    });
  },
  invoke_agent_list_conversations: (event) => {
    return authorizedAgentResult(event, () => MainAgent.listConversations());
  },
  invoke_agent_list_runs: (event) => {
    return authorizedAgentData(event, () => MainAgent.listRuns());
  },
  invoke_agent_get_conversation: (event, id) => {
    return authorizedAgentResult(event, () => MainAgent.getConversationSnapshot(id));
  },
  invoke_agent_remove_conversation: (event, id) => {
    return authorizedAgentResult(event, () => MainAgent.removeConversation(id));
  },
  invoke_agent_chat: (event, options) => {
    return authorizedAgentResult(event, () => MainAgent.chat(options));
  },
  invoke_agent_abort: (event, runID) => {
    return authorizedAgentResult(event, () => MainAgent.abort(runID));
  },
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
  invoke_device_gpu: async () => app.whenReady().then(() => app.getGPUInfo("complete")),
  invoke_device_platform: () => process.platform,
  invoke_device_net: async (): Promise<NetworkStatus> => {
    // Dns.resolve 可能因为各种原因失败，比如本地网络配置问题，但不代表当前网络不可用
    try {
      await Dns.resolve("www.baidu.com");
    } catch {
      return "dns_error";
    }
    // TCP 连接失败则认为当前网络不可用
    const tcp = await new Promise<boolean>((resolve) => {
      const socket = Net.createConnection(
        {
          host: "www.baidu.com",
          port: 443,
          timeout: 3000
        },
        () => {
          socket.end();
          resolve(true);
        }
      );
      socket.on("error", () => resolve(false));
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (!tcp) {
      return "tcp_error";
    }
    // HTTPS 请求失败则认为 TLS 有问题
    const https = await new Promise<boolean>((resolve) => {
      const req = Https.request(
        {
          hostname: "www.baidu.com",
          method: "GET",
          timeout: 3000
        },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );
      req.on("error", () => {
        resolve(false);
      });
      req.end();
    });
    if (!https) {
      return "tls_error";
    }

    return "ok";
  },
  invoke_window_id: (e) => {
    const sender = BrowserWindow.fromWebContents(e.sender);
    return MainWindowManager.getId(sender)!;
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

const toAgentInvokeError = (error: unknown) => {
  if (error instanceof AIError) {
    return {
      ok: false,
      reason: {
        type: error.type,
        message: error.message
      }
    } as const;
  }
  return {
    ok: false,
    reason: {
      type: "unknown" as AIErrorCode,
      message: error instanceof Error ? error.message : String(error)
    }
  } as const;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]) => {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
};

/**
 * Agent IPC 只接收 Agent 窗口自身主框架发出的请求。
 * 既校验窗口身份，也拒绝 iframe 和导航到外部页面后的调用。
 */
export const isAuthorizedAgentInvokeSender = (event: IpcMainInvokeEvent) => {
  try {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow || MainWindowManager.getId(senderWindow) !== "agent") return false;
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return false;

    const url = new URL(event.senderFrame.url);
    const expectedFrameURL = MainWindowManager.getAppFrameURL(senderWindow);
    if (!expectedFrameURL) return false;
    const expectedURL = new URL(expectedFrameURL);
    return (
      url.protocol === "http:" &&
      url.hostname === "localhost" &&
      Boolean(url.port) &&
      url.pathname === "/agent.html" &&
      url.origin === expectedURL.origin &&
      url.pathname === expectedURL.pathname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

const unauthorizedAgentInvokeResult = () =>
  ({
    ok: false,
    reason: {
      type: "auth" as AIErrorCode,
      message: "拒绝来自非 Agent 应用主框架的 IPC 请求"
    }
  }) as const;

const agentResult = async <T>(action: () => AIResult<T> | Promise<AIResult<T>>) => {
  try {
    const result = await action();
    if (result.isErr()) {
      return {
        ok: false,
        reason: {
          type: result.reason.type,
          message: result.reason.message
        }
      } as const;
    }

    return {
      ok: true,
      data: structuredClone(result.unwrap())
    } as const;
  } catch (error) {
    Log.error("invoke(agent)", error);
    return toAgentInvokeError(error);
  }
};

const agentData = <T>(action: () => T) => {
  try {
    return {
      ok: true,
      data: structuredClone(action())
    } as const;
  } catch (error) {
    Log.error("invoke(agent)", error);
    return toAgentInvokeError(error);
  }
};

const authorizedAgentResult = <T>(
  event: IpcMainInvokeEvent,
  action: () => AIResult<T> | Promise<AIResult<T>>
) => {
  if (!isAuthorizedAgentInvokeSender(event)) {
    Log.warn("invoke(agent)", "拒绝非 Agent 主框架请求");
    return Promise.resolve(unauthorizedAgentInvokeResult());
  }
  return agentResult(action);
};

const authorizedAgentData = <T>(event: IpcMainInvokeEvent, action: () => T) => {
  if (!isAuthorizedAgentInvokeSender(event)) {
    Log.warn("invoke(agent)", "拒绝非 Agent 主框架请求");
    return unauthorizedAgentInvokeResult();
  }
  return agentData(action);
};
