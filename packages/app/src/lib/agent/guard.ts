import { BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { Log } from "@/lib/log";
import { MainWindowManager } from "@/lib/window-manager";
import type { AgentInvokeResult } from "@mahiru/ipc/types";

/** 应用窗口入口路径；类型与入口路径一一对应，避免调用点各写一份而错配。 */
const AppFramePath = {
  main: "/",
  agent: "/agent.html",
  display: "/display.html"
} as const;

export type MainAppWindowType = keyof typeof AppFramePath;

/** Agent IPC 的两类授权范围：控制面，与功能设置（MCP 工具白名单 / 总开关）。 */
export type MainAgentScope = "agent" | "settings";

/**
 * Agent IPC 的调用闸门：判断发送方是不是应用自身主框架，并把它要执行的读取 / 写入折叠成统一的 IPC 结果。
 *
 * 这是控制 token 的唯一发放闸门——preload 暴露的是通用 invoke，任何窗口的任何页面都能按名字调用，
 * 且窗口导航到外部页面后 preload 仍会注入。因此必须同时校验窗口身份、主框架（拒绝 iframe）、
 * origin 与窗口创建时登记的地址一致，以及路径落在该窗口入口内。
 */
export class MainAgentGuard {
  /** 任意应用窗口主框架；其他通道需要同样约束时直接复用。 */
  static isWindow(event: IpcMainInvokeEvent, windowType: MainAppWindowType): boolean {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      if (!senderWindow || MainWindowManager.getId(senderWindow) !== windowType) return false;
      if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) return false;

      const expectedFrameURL = MainWindowManager.getAppFrameURL(senderWindow);
      if (!expectedFrameURL) return false;

      const url = new URL(event.senderFrame.url);
      return (
        // origin 已包含协议、主机与端口，无需再逐项比较
        url.origin === new URL(expectedFrameURL).origin &&
        MainAgentGuard.isWithinAppPath(url.pathname, AppFramePath[windowType]) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }

  /** 校验并执行异步通道；鉴权失败与执行异常都折叠成 AgentInvokeResult。 */
  static async call<T>(
    event: IpcMainInvokeEvent,
    scope: MainAgentScope,
    action: () => T | Promise<T>
  ): Promise<AgentInvokeResult<T>> {
    const rejected = MainAgentGuard.reject(event, scope);
    if (rejected) return rejected;
    try {
      return { ok: true, data: structuredClone(await action()) };
    } catch (error) {
      Log.error("invoke(agent)", error);
      return MainAgentGuard.failure(error);
    }
  }

  /** 同步通道专用：payload 在 packages/ipc 中声明为非 Promise，必须同步返回。 */
  static callSync<T>(
    event: IpcMainInvokeEvent,
    scope: MainAgentScope,
    action: () => T
  ): AgentInvokeResult<T> {
    const rejected = MainAgentGuard.reject(event, scope);
    if (rejected) return rejected;
    try {
      return { ok: true, data: structuredClone(action()) };
    } catch (error) {
      Log.error("invoke(agent)", error);
      return MainAgentGuard.failure(error);
    }
  }

  /** Agent 窗口主框架：控制 token 与页面上下文的唯一合法调用方。 */
  private static isAgent(event: IpcMainInvokeEvent) {
    return MainAgentGuard.isWindow(event, "agent");
  }

  /** 功能设置属于另一层权限，只下放给主窗口与 display 主框架。 */
  private static isAgentSettings(event: IpcMainInvokeEvent) {
    return MainAgentGuard.isWindow(event, "main") || MainAgentGuard.isWindow(event, "display");
  }

  private static reject(event: IpcMainInvokeEvent, scope: MainAgentScope) {
    const allowed =
      scope === "agent" ? MainAgentGuard.isAgent(event) : MainAgentGuard.isAgentSettings(event);
    if (allowed) return undefined;
    Log.warn("invoke(agent)", `拒绝非授权应用主框架的请求：${scope}`);
    return {
      ok: false,
      reason: { code: "auth", message: "拒绝来自非 Agent 应用主框架的 IPC 请求" }
    } as const;
  }

  private static failure(error: unknown) {
    return {
      ok: false,
      reason: {
        code: "unknown",
        message: error instanceof Error ? error.message : String(error)
      }
    } as const;
  }

  /** SPA 会在初始页面地址下继续路由（如 /display.html/settings），允许其子路径。 */
  private static isWithinAppPath(pathname: string, base: string) {
    if (pathname === base) return true;
    const prefix = base.endsWith("/") ? base : `${base}/`;
    return pathname.startsWith(prefix);
  }
}
