import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { ChildProcessByStdio, spawn } from "node:child_process";
import { Readable } from "node:stream";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const exeName = process.platform === "win32" ? "server.exe" : "server";
const defaultServerPath = join(__dirname, "dist", exeName);

export default class Store {
  private serverProc;
  private _running;
  private readonly enableConsole;
  private readonly _logger;
  private _exitHandler = new Set<NormalFunc<[code: Nullable<number>]>>();
  private _errorHandler = new Set<NormalFunc<[err: Error]>>();
  private static instance: Nullable<Store> = null;

  // 仅在类 Unix-like 系统上有效，Windows 几乎和强制杀死进程没有区别
  // 通过 http 让服务端自己优雅退出，才能保证数据完整性
  async stop(timeoutMs = 5000): Promise<boolean> {
    if (!this._running) return true;
    return new Promise<boolean>((resolve) => {
      let timer: NodeJS.Timeout | null = null;
      const onExit = () => finish(true);
      const finish = (ok: boolean) => {
        timer && clearTimeout(timer);
        this.serverProc.removeListener("exit", onExit);
        resolve(ok);
      };
      // 超时处理：如果在 timeoutMs 时间内进程没有退出，强制杀死进程
      timer = setTimeout(() => {
        if (!this._running) return finish(true);
        try {
          // kill 不会等待进程退出，而是立即返回
          this.serverProc.kill("SIGKILL");
        } catch (err) {
          this._logger?.(Buffer.from("error while force killing server: " + err));
        }
        finish(false);
      }, timeoutMs);

      try {
        // 正常流程：发送 SIGTERM，等待进程退出
        this.serverProc.once("exit", onExit);
        let sent: boolean;
        if (process.platform === "win32") {
          // Windows 上没有 SIGTERM 信号
          sent = this.serverProc.kill("SIGINT");
        } else {
          sent = this.serverProc.kill("SIGTERM");
        }
        if (!sent && this._running) throw new Error("failed to send SIGTERM");
      } catch (err) {
        this._logger?.(Buffer.from("error while stopping server: " + err));
        finish(!this._running);
      }
    });
  }

  // 通过 HTTP 接口请求退出
  async stopByHttp(port: number, token: string) {
    if (!this._running) return true;
    return fetch(`http://localhost:${port}/api/exit`, {
      method: "GET",
      headers: { Authorization: token }
    })
      .then((res) => res.ok)
      .catch(() => false);
  }

  onExit(handler: NormalFunc<[code: Nullable<number>]>) {
    this._exitHandler.add(handler);
    return () => this._exitHandler.delete(handler);
  }

  onError(handler: NormalFunc<[err: Error]>) {
    this._errorHandler.add(handler);
    return () => this._errorHandler.delete(handler);
  }

  offExit(handler: NormalFunc<[code: Nullable<number>]>) {
    this._exitHandler.delete(handler);
  }

  offError(handler: NormalFunc<[err: Error]>) {
    this._errorHandler.delete(handler);
  }

  get running() {
    return this._running;
  }

  get pid() {
    return this.serverProc.pid!;
  }

  private constructor(
    process:
      | ChildProcessByStdio<null, Readable, Readable> // ["ignore","pipe","pipe"]
      | ChildProcessByStdio<null, null, null>, // ["ignore","ignore","ignore"]
    props: {
      enableConsole: boolean;
      logger: NormalFunc<[msg: Buffer]>;
    }
  ) {
    this.serverProc = process;
    this._running = true;
    this.enableConsole = props.enableConsole;
    this._logger = props.logger;
    this.init();
  }

  private init() {
    this.serverProc.addListener("exit", (code) => {
      if (this.enableConsole && this._logger) {
        this._logger(Buffer.from("server exited: " + code));
      } else {
        console.warn("server exited", code);
      }
      this._running = false;
      Store.instance = null;
      for (const handler of this._exitHandler) {
        try {
          handler(code);
        } catch (err) {
          console.error("error in exit handler", err);
        }
      }
      this._exitHandler.clear();
    });

    this.serverProc.addListener("error", (err) => {
      if (this.enableConsole && this._logger) {
        this._logger(Buffer.from("server error: " + err.message));
      } else {
        console.error("server error", err);
      }
      this._running = false;
      Store.instance = null;
      for (const handler of this._errorHandler) {
        try {
          handler(err);
        } catch (error) {
          console.error("error in error handler", error);
        }
      }
      this._errorHandler.clear();
    });

    this.serverProc.stdout?.setEncoding("utf-8");
    this.serverProc.stderr?.setEncoding("utf-8");
    if (this.enableConsole && this.serverProc.stdout) {
      this.serverProc.stdout.on("data", this._logger);
      this.serverProc.stderr.on("data", this._logger);
    }
  }

  static run(props: {
    args: string[];
    logger?: NormalFunc<[msg: Buffer]>;
    enableConsole?: boolean;
    path?: string;
    onExit?: NormalFunc<[code?: number]>;
  }) {
    if (this.instance) return this.instance;

    props.path ||= defaultServerPath;
    props.logger ||= (b: Buffer) => console.log("[store service stdout]", b.toString());
    props.enableConsole ??= true;

    if (!existsSync(props.path)) {
      throw new Error(`executable file not found: ${props.path}`);
    }

    let serverProc;
    if (props.enableConsole) {
      serverProc = spawn(props.path, props.args, {
        stdio: ["ignore", "pipe", "pipe"]
      });
    } else {
      serverProc = spawn(props.path, props.args, {
        stdio: ["ignore", "ignore", "ignore"]
      });
    }

    if (!serverProc) {
      throw new Error("failed to start server process.");
    }
    if (props.onExit) serverProc.addListener("exit", props.onExit);

    this.instance = new Store(serverProc, {
      enableConsole: props.enableConsole,
      logger: props.logger
    });

    return this.instance;
  }
}
