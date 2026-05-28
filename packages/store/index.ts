import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { type ChildProcessByStdio, spawn } from "node:child_process";
import { Readable } from "node:stream";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const exeName = process.platform === "win32" ? "server.exe" : "server";
const defaultServerPath = join(__dirname, "dist", exeName);

export default class Store {
  private serverProc;
  private port;
  private token;
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
  async stopByHttp(): Promise<boolean> {
    if (!this._running) return true;
    return fetch(`http://localhost:${this.port}/api/exit`, {
      method: "GET",
      headers: { Authorization: this.token }
    })
      .then(
        () =>
          new Promise<boolean>((resolve) => {
            // 等待 2.5 秒后再检查进程是否退出
            setTimeout(() => resolve(!this._running), 2500);
          })
      )
      .catch(() => false);
  }

  async ping(): Promise<boolean> {
    return fetch(`http://localhost:${this.port}/api/ping`, {
      method: "GET",
      headers: { Authorization: this.token }
    })
      .then((res) => res.text())
      .then((text) => text.toLocaleLowerCase().trim() === "ok")
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
      port: number;
      token: string;
    }
  ) {
    this.serverProc = process;
    this._running = true;
    this.enableConsole = props.enableConsole;
    this._logger = props.logger;
    this.port = props.port;
    this.token = props.token;
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

  static handleArgs(args: Record<string, number | string | null>): string[] {
    return Object.entries(args)
      .filter((a): a is [string, number | string] => a[1] !== null)
      .map(([flag, value]) => [flag.startsWith("--") ? flag : `--${flag}`, String(value)])
      .flat();
  }

  static run(props: {
    args?: Record<string, string | number | null>;
    port: number;
    token: string;
    scheme: string;
    storePath: Nullable<string>;
    assetsHostname: string;
    /** eg: "24h" */
    ttl: Nullable<string>;
    capacity: Nullable<number>;
    logger?: NormalFunc<[msg: Buffer]>;
    enableConsole?: boolean;
    path?: string;
    onExit?: NormalFunc<[code?: number]>;
  }) {
    if (this.instance) return this.instance;

    props.args = {
      ...props.args,
      port: props.port,
      key: props.token,
      ttl: props.ttl,
      scheme: props.scheme,
      "assets-hostname": props.assetsHostname,
      path: props.storePath,
      capacity: props.capacity
    };
    props.path ||= defaultServerPath;
    props.logger ||= (b: Buffer) => console.log("[store service stdout]", b.toString());
    props.enableConsole ??= true;

    if (!existsSync(props.path)) {
      throw new Error(`executable file not found: ${props.path}`);
    }

    let serverProc;
    if (props.enableConsole) {
      serverProc = spawn(props.path, Store.handleArgs(props.args), {
        stdio: ["ignore", "pipe", "pipe"]
      });
    } else {
      serverProc = spawn(props.path, Store.handleArgs(props.args), {
        stdio: ["ignore", "ignore", "ignore"]
      });
    }

    if (!serverProc) {
      throw new Error("failed to start server process.");
    }
    if (props.onExit) serverProc.addListener("exit", props.onExit);

    this.instance = new Store(serverProc, {
      enableConsole: props.enableConsole,
      logger: props.logger,
      port: props.port,
      token: props.token
    });

    return this.instance;
  }
}
