import { readFileSync } from "node:fs";
import { app, session } from "electron";
import { X509Certificate } from "node:crypto";
import { Log } from "@/lib/log";
import { MainHandle } from "@/lib/handle";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainExitCodeConstants } from "@/constants/exit-code";

import { MainApp } from "./app";

/**
 * @desc 程序的入口 \
 * 位于所有服务、IPC之前，用于处理 commands 和多实例，确认之后才会进入（执行）程序实例
 * */
export class MainEntry {
  instance: MainApp;

  constructor(instance: MainApp) {
    this.instance = instance;
  }

  private permissions(permissions: string[]) {
    const allowPermissions = new Set(permissions);
    app.whenReady().then(() => {
      session.defaultSession.setPermissionRequestHandler(
        (webContents, permission, callback, details) => {
          const url = details.requestingUrl || webContents.getURL();
          if (!MainHandle.isTrustedOrigin(url)) {
            Log.warn("Permission Request", `origin "${url}" is not trusted`);
            return callback(false);
          }
          callback(allowPermissions.has(permission));
        }
      );
      session.defaultSession.setPermissionCheckHandler(
        (_, permission, requestingOrigin, details) => {
          const url = details.requestingUrl || requestingOrigin;
          if (!MainHandle.isTrustedOrigin(url)) {
            Log.warn("Permission Check", `origin "${url}" is not trusted`);
            return false;
          }
          return allowPermissions.has(permission);
        }
      );
    });
  }

  private commands(commands: [the_switch: string, value?: string][]) {
    app.enableSandbox();
    process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
    for (const [the_switch, value] of commands) {
      app.commandLine.appendSwitch(the_switch, value);
    }
  }

  /**
   * @desc 信任本地 HTTPS 代理的自签证书 \
   * 仅对 localhost / 127.0.0.1 生效，其余主机回退 Chromium 默认校验（callback(-3)） \
   * 回环地址无法被网络侧中间人劫持，指纹不匹配时拒绝，避免信任错误的证书
   * */
  private certificate() {
    app.whenReady().then(() => {
      try {
        // 读取 localhost-cert.pem
        // 计算 SHA-256 指纹
        const cert = new X509Certificate(readFileSync(MainPathResolver.localhostCertPath));
        const fingerprint = cert.fingerprint256;

        //  0  接受证书  指纹完全匹配时使用
        // -1 Chromium 的 `ERR_IO_PENDING`，表示异步操作尚未完成
        // -2 明确拒绝证书 指纹不匹配、数据缺失、解析失败时使用
        // -3 不做自定义决定，采用 Chromium 原本的校验结果
        session.defaultSession.setCertificateVerifyProc((request, callback) => {
          const isLoopback = request.hostname === "localhost" || request.hostname === "127.0.0.1";
          if (!isLoopback) return callback(-3);

          // 本地代理必须提供可以解析的证书
          const peerData = request.certificate?.data;
          if (!peerData) return callback(-2);

          try {
            const peer = new X509Certificate(peerData);
            return callback(peer.fingerprint256 === fingerprint ? 0 : -2);
          } catch {
            return callback(-2);
          }
        });
        Log.info("cert", "trusted local proxy certificate for localhost/127.0.0.1");
      } catch (err) {
        Log.warn("cert", "failed to trust local proxy certificate", err);
      }
    });
  }

  tryRun() {
    this.commands([]);
    this.certificate();
    this.permissions(["speaker-selection", "clipboard-sanitized-write"]);
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      this.instance.init();
    } else {
      // 多实例，正常退出
      app.exit(MainExitCodeConstants.MULTI_INSTANCE);
    }
  }
}
