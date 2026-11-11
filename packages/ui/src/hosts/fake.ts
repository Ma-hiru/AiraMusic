/**
 * 假宿主（S0）
 *
 * 在没有 Electron / Tauri 宿主的情况下，把渲染层唯一依赖的 `globalThis.electron`
 * 用浏览器原生能力补齐，让全部 HTML 入口能在普通浏览器里启动。
 *
 * 它不是测试替身，而是**宿主契约的可执行规格**：每个 invoke / event 的取值形状
 * 必须与 `packages/ipc/src/types/{invoke,event,message}.ts` 保持一致。Rust 宿主
 * 的实现只需要满足同一份契约。
 *
 * 启用方式：`APP_HOST=fake yarn dev:ui`（见 `.env.fake`）。
 * 注入点：`vite.config.ts` 的 `aira-fake-host` 插件，在所有 HTML 的 head 前置
 * 一个 module script —— module script 按文档顺序求值，因此它一定早于
 * `@mahiru/ipc/renderer` 的模块级 `globalThis["electron"]` 读取。
 */

const ApiKey = "electron";
const MessageChannelName = "aira-fake-message";
const StorePrefix = "aira:store:";

type FakeWindowType =
  | "main"
  | "tray"
  | "about"
  | "agent"
  | "image"
  | "login"
  | "lyric"
  | "radio"
  | "display"
  | "comments"
  | "external"
  | "miniplayer";

/** 页面路径 → 窗口类型。窗口类型是 IPC 寻址的唯一标识。 */
const PageToWindow: Record<string, FakeWindowType> = {
  "/": "main",
  "/index.html": "main",
  "/login.html": "login",
  "/mini.html": "miniplayer",
  "/lyric.html": "lyric",
  "/tray.html": "tray",
  "/image.html": "image",
  "/agent.html": "agent",
  "/comments.html": "comments",
  "/display.html": "display",
  "/radio.html": "radio",
  "/about.html": "about"
};

/** 窗口类型 → 页面路径，用于 `event_window_open`。 */
const WindowToPage: Record<FakeWindowType, string> = {
  main: "/",
  login: "/login.html",
  miniplayer: "/mini.html",
  lyric: "/lyric.html",
  tray: "/tray.html",
  image: "/image.html",
  agent: "/agent.html",
  comments: "/comments.html",
  display: "/display.html",
  radio: "/radio.html",
  about: "/about.html",
  external: "about:blank"
};

const currentWindow: FakeWindowType = PageToWindow[location.pathname] ?? "main";

const runtimeId = `fake-runtime-${crypto.randomUUID()}`;
const runtimeToken = `fake-token-${crypto.randomUUID()}`;

function detectPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "win32";
  if (ua.includes("mac")) return "darwin";
  return "linux";
}

function storeKey(key: string) {
  return `${StorePrefix}${key}`;
}

function readStore(key: string): { ok: true; value: unknown } | { ok: false; reason: string } {
  try {
    const raw = localStorage.getItem(storeKey(key));
    if (raw === null) return { ok: true, value: null };
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

const agentsDisabled = {
  ok: false,
  reason: { code: "unknown", message: "假宿主未实现 Agent 能力" }
} as const;

type InvokeHandler = (arg: never) => unknown;

const invokeHandlers: Record<string, InvokeHandler> = {
  // runtime
  invoke_runtime_id: () => runtimeId,
  invoke_runtime_token: () => runtimeToken,

  // window
  invoke_window_id: () => currentWindow,
  invoke_window_opened: () => true,
  invoke_window_shown: () => document.visibilityState === "visible",
  invoke_window_pinned: () => false,
  invoke_window_maximized: () => false,
  invoke_window_fullscreen: () => Boolean(document.fullscreenElement),
  invoke_window_bounds: () => ({
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    workAreaWidth: window.screen.availWidth,
    workAreaHeight: window.screen.availHeight
  }),

  // device
  invoke_device_gpu: () => ({ gpuDevice: [] }),
  invoke_device_name: () => navigator.platform || "web",
  invoke_device_platform: () => detectPlatform(),
  invoke_device_net: () => (navigator.onLine ? "ok" : "offline"),
  invoke_net_fetch: async (request: never) => {
    const { init, input } = request as { input: string; init: RequestInit };
    const response = await fetch(input, init);
    const body = await response.arrayBuffer();
    return {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      type: response.type,
      redirected: response.redirected,
      body,
      headers: Object.fromEntries(response.headers)
    };
  },

  // store
  invoke_store_get: (key: never) => readStore(String(key)),
  invoke_store_set: (payload: never) => {
    const { key, value } = payload as { key: string; value: unknown };
    try {
      localStorage.setItem(storeKey(key), JSON.stringify(value));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  },
  invoke_store_delete: (key: never) => {
    try {
      localStorage.removeItem(storeKey(String(key)));
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  },

  // cache（Go 服务在浏览器里不存在，给一份稳定的默认配置）
  invoke_cache_config_get: () => ({
    ttl: "1h",
    path: "aira-cache",
    capacity: 1024
  }),
  invoke_cache_config_update: (input: never) => ({
    ok: true,
    config: {
      ttl: "1h",
      path: "aira-cache",
      capacity: 1024,
      ...(input as object)
    }
  }),

  // fs / log：浏览器没有文件系统，统一按“用户取消”处理
  invoke_fs_select: () => ({ ok: false, path: "", canceled: true }),
  invoke_fs_save: () => ({ ok: false, canceled: true }),
  invoke_log_export: () => ({ ok: false, canceled: true }),

  // agent：假宿主不提供
  invoke_agent_context: () => agentsDisabled,
  invoke_agent_connection: () => agentsDisabled,
  invoke_agent_feature_settings_get: () => agentsDisabled,
  invoke_agent_feature_settings_update: () => agentsDisabled
};

type ReceivePayload = { from: string; type: string; data: unknown };
type MessageListener = (message: ReceivePayload) => void;

const messageListeners = new Set<MessageListener>();

const bus = new BroadcastChannel(MessageChannelName);
bus.onmessage = (event: MessageEvent) => {
  const message = event.data as
    | undefined
    | { to: string; from: string; type: string; data: unknown };
  if (!message) return;
  if (message.to !== currentWindow && message.to !== "all") return;
  const payload: ReceivePayload = {
    from: message.from,
    type: message.type,
    data: message.data
  };
  for (const listener of messageListeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error("[fake-host] message listener failed", error);
    }
  }
};

function openWindow(type: FakeWindowType) {
  const page = WindowToPage[type];
  if (!page) return;
  const opened = window.open(page, `aira-${type}`, "popup,width=1024,height=720");
  if (!opened) console.warn(`[fake-host] 浏览器拦截了 ${type} 窗口的弹出`);
}

type EventHandler = (payload: unknown) => void;

const eventHandlers: Record<string, EventHandler> = {
  event_window_open: (type) => openWindow(type as FakeWindowType),
  event_window_close: () => {
    if (currentWindow !== "main") window.close();
  },
  event_window_show: () => {},
  event_window_hidden: () => {},
  event_window_focus: () => window.focus(),
  event_window_debug: () => console.info("[fake-host] openDevTools"),
  event_window_title: (payload) => {
    const { title } = payload as { title: string };
    if (title) document.title = title;
  },
  event_window_browser: (payload) => {
    const { url } = payload as { url: string };
    window.open(url, "_blank", "noopener,noreferrer");
  },
  event_window_external: (payload) => {
    const { url } = payload as { url: string };
    window.open(url, "_blank", "noopener,noreferrer");
  },
  event_debug_log: (payload) => {
    const { level, message } = payload as {
      message: string;
      level: "info" | "warn" | "debug" | "error" | "trace";
    };
    const method = level === "trace" ? "debug" : level;
    console[method](`[renderer:${currentWindow}] ${message}`);
  },
  event_debug_fatal: (payload) => {
    console.error("[fake-host] fatal", payload);
  },
  event_app_restart: () => location.reload()
};

const api = {
  invoke: async (event: string, arg: unknown): Promise<unknown> => {
    const handler = invokeHandlers[event];
    if (!handler) {
      console.warn(`[fake-host] 未实现的 invoke: ${event}`);
      return undefined;
    }
    return handler(arg as never);
  },
  event: (event: string, payload: unknown): void => {
    const handler = eventHandlers[event];
    if (!handler) {
      console.debug(`[fake-host] 未处理的 event: ${event}`, payload);
      return;
    }
    handler(payload);
  },
  message: {
    send: (message: { to: string; type: string; data: unknown }) => {
      bus.postMessage({ ...message, from: currentWindow });
    },
    listen: (listener: MessageListener) => {
      messageListeners.add(listener);
    }
  }
};

Object.defineProperty(globalThis, ApiKey, {
  value: api,
  configurable: true,
  enumerable: true,
  writable: false
});

console.info(`[fake-host] 已接管 IPC，窗口类型 = ${currentWindow}`);

export {};
