/**
 * AiraMusic IPC 垫片
 *
 * 由 Rust 宿主以 `initialization_script` 注入（默认只在主框架执行），
 * 在页面任何脚本之前把 `globalThis.electron` 建好，从而让
 * `@mahiru/ipc/renderer` 的模块级读取拿到完整的 `Api`。
 *
 * 三个命令与 Electron 的四个方法一一对应：
 *   invoke         → aira_invoke
 *   event          → aira_event
 *   message.send   → aira_message_send
 *   message.listen → 本地回调表，由宿主通过 __aira_deliver 推送
 *
 * 当宿主注入 `globalThis.__AIRA_DEBUG = true` 时，额外接管 console 与全局错误，
 * 转发到宿主终端（[console:<窗口>]）。WKWebView 的远程调试依赖 Safari，无法脚本化，
 * 这条通道是等价的替代品。
 */
(() => {
  "use strict";

  if (globalThis.electron) return;

  const internals = globalThis.__TAURI_INTERNALS__;
  if (!internals || typeof internals.invoke !== "function") {
    console.error("[aira] __TAURI_INTERNALS__ 不可用，IPC 垫片未安装");
    return;
  }

  const listeners = new Set();

  // ---- 能力补齐：WKWebView 缺少部分 Chromium API ----
  // `requestIdleCallback` 在 Safari/WKWebView 里不存在，React 生态有库会直接用，
  // 缺失会在渲染阶段抛 "Can't find variable"，被 ErrorBoundary 捕获后整页报错。
  if (typeof globalThis.requestIdleCallback !== "function") {
    const timers = new Map();
    let nextId = 1;
    globalThis.requestIdleCallback = (callback) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        timers.delete(id);
        callback({ didTimeout: false, timeRemaining: () => 8 });
      }, 1);
      timers.set(id, timer);
      return id;
    };
    globalThis.cancelIdleCallback = (id) => {
      const timer = timers.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(id);
      }
    };
  }

  globalThis.__aira_deliver = (message) => {
    for (const listener of listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error("[aira] message listener failed", error);
      }
    }
  };

  // `invoke_net_fetch` 的 body 在 JSON 里传 ArrayBuffer 会被序列化成 {}，
  // 这里统一转成 base64；返回时再还原成 ArrayBuffer。
  const toBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  };

  const fromBase64 = (text) => {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  };

  const prepareInvoke = (event, arg) => {
    if (event === "invoke_fs_save" && arg && arg.buffer instanceof ArrayBuffer)
      return { ...arg, buffer: { __base64: toBase64(arg.buffer) } };
    if (
      event !== "invoke_net_fetch" ||
      !arg ||
      !arg.init ||
      !(arg.init.body instanceof ArrayBuffer)
    )
      return arg;
    return { ...arg, init: { ...arg.init, body: { __base64: toBase64(arg.init.body) } } };
  };

  const finishInvoke = (event, result) => {
    if (event === "invoke_net_fetch" && result && result.body && result.body.__base64)
      return { ...result, body: fromBase64(result.body.__base64) };
    return result;
  };

  globalThis.electron = {
    invoke: (event, arg) => {
      // 需要弹窗/等网络的通道走独立异步命令（同步命令跑在主线程）
      let call;
      if (event === "invoke_net_fetch") {
        call = internals.invoke("aira_net_fetch", { request: prepareInvoke(event, arg) });
      } else if (event === "invoke_fs_select") {
        call = internals.invoke("aira_fs_select", { kind: arg });
      } else if (event === "invoke_log_export") {
        call = internals.invoke("aira_log_export", { scope: arg });
      } else if (event === "invoke_fs_save") {
        const payload = prepareInvoke(event, arg);
        call = internals.invoke("aira_fs_save", {
          name: payload.name,
          buffer: payload.buffer
        });
      } else if (
        event === "invoke_store_get" ||
        event === "invoke_store_set" ||
        event === "invoke_store_delete"
      ) {
        call = internals.invoke("aira_store", { event, arg: arg === undefined ? null : arg });
      } else {
        call = internals.invoke("aira_invoke", {
          event,
          arg: arg === undefined ? null : arg
        });
      }
      return call.then((result) => finishInvoke(event, result));
    },
    event: (event, payload) => {
      internals.invoke("aira_event", { event, payload }).catch((error) => {
        console.error("[aira] event failed", event, error);
      });
    },
    message: {
      send: (payload) => {
        internals.invoke("aira_message_send", { payload }).catch((error) => {
          console.error("[aira] message send failed", payload && payload.type, error);
        });
      },
      listen: (callback) => {
        listeners.add(callback);
      }
    }
  };

  // ---- 请求追踪（排障用，默认关闭）----
  // `localStorage.aira_trace = "1"` 后刷新，页面发出的每个请求都会记进环形缓冲：
  //   __eval 里读 `globalThis.__airaRequests` 就能看到「某个 UI 动作到底打了哪些接口」。
  (() => {
    let enabled = false;
    try {
      enabled = localStorage.getItem("aira_trace") === "1";
    } catch {
      return;
    }
    if (!enabled) return;
    const buffer = (globalThis.__airaRequests = []);
    const record = (entry) => {
      buffer.push(entry);
      if (buffer.length > 200) buffer.shift();
    };
    const originalFetch = globalThis.fetch;
    if (typeof originalFetch === "function") {
      globalThis.fetch = function (input, init) {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        const started = Date.now();
        const promise = originalFetch.call(this, input, init);
        promise
          .then((response) => record({ url, status: response.status, ms: Date.now() - started }))
          .catch((error) => record({ url, error: String(error), ms: Date.now() - started }));
        return promise;
      };
    }
    // ncm 的 apiRequest 走 axios（XHR），fetch 拦不到
    const OriginalXHR = globalThis.XMLHttpRequest;
    if (typeof OriginalXHR === "function") {
      const open = OriginalXHR.prototype.open;
      const send = OriginalXHR.prototype.send;
      OriginalXHR.prototype.open = function (method, url, ...rest) {
        this.__airaUrl = String(url);
        return open.call(this, method, url, ...rest);
      };
      OriginalXHR.prototype.send = function (...args) {
        const url = this.__airaUrl || "";
        const started = Date.now();
        this.addEventListener("loadend", () =>
          record({ url, status: this.status, ms: Date.now() - started, kind: "xhr" })
        );
        return send.apply(this, args);
      };
    }
  })();

  // ---- WKWebView 合成层修复 ----
  // SPA 路由切换后，WebKit 偶尔不会重绘内容层：DOM 已经换成新页面（能命中、能读文本），
  // 屏幕上却还是旧画面/空白，随便开合一次侧边栏（触发重排）就又正常。
  // 这里在 URL 变化后强制重建一次合成层（translateZ 不改观感，只让 WebKit 重新合成）。
  // 放在垫片里而不是 UI：这是宿主平台的兼容层，Electron 侧不受影响。
  (() => {
    let last = location.href;
    let scheduled = false;
    const nudge = () => {
      const root = document.documentElement;
      if (!root) return;
      root.style.willChange = "transform";
      root.style.transform = "translateZ(0)";
      const reset = () => {
        root.style.transform = "";
        root.style.willChange = "";
        scheduled = false;
      };
      // 下一帧 + 稍后各来一次：React 的提交时机不确定，两次足够覆盖
      requestAnimationFrame(() => requestAnimationFrame(reset));
      setTimeout(() => {
        if (!scheduled) return;
        reset();
      }, 160);
    };
    const check = () => {
      if (location.href === last) return;
      last = location.href;
      if (scheduled) return;
      scheduled = true;
      nudge();
    };
    for (const name of ["pushState", "replaceState"]) {
      const original = history[name];
      if (typeof original !== "function") continue;
      history[name] = function (...args) {
        const result = original.apply(this, args);
        check();
        return result;
      };
    }
    addEventListener("popstate", check);
  })();

  // 就绪握手：宿主据此确认「垫片先于页面脚本生效」。
  internals
    .invoke("aira_event", {
      event: "aira_ready",
      payload: { href: location.href }
    })
    .catch(() => {});

  // ---- 控制台桥（仅调试模式）----
  if (!globalThis.__AIRA_DEBUG) return;

  let sending = false;
  const MAX = 4000;

  const stringify = (value) => {
    if (value instanceof Error)
      return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const send = (level, parts) => {
    if (sending) return; // 避免 invoke 失败 -> console.error -> 再次 send 的递归
    sending = true;
    try {
      const text = parts.map(stringify).join(" ").slice(0, MAX);
      internals
        .invoke("aira_event", {
          event: "aira_log",
          payload: { level, text, href: location.href }
        })
        .catch(() => {});
    } finally {
      sending = false;
    }
  };

  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      send(level, args);
      original(...args);
    };
  }

  globalThis.addEventListener("error", (event) => {
    send("error", [
      "onerror:",
      event.message,
      `${event.filename || ""}:${event.lineno || 0}:${event.colno || 0}`
    ]);
  });

  globalThis.addEventListener("unhandledrejection", (event) => {
    send("error", ["unhandledrejection:", event.reason]);
  });
})();
