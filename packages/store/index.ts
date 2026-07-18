import { join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Readable, Writable } from "node:stream";
import { spawn, type ChildProcessByStdio } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const exeName = process.platform === "win32" ? "aira-music-cache.exe" : "aira-music-cache";
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
      let timer: null | NodeJS.Timeout = null;
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
            // 等待 1.2 秒后再检查进程是否退出
            setTimeout(() => resolve(!this._running), 1200);
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

  private static exitHookRegistered = false;

  /**
   * 兜底：宿主进程退出时（无论是否走过 stop()）同步给服务端发终止信号，
   * 覆盖 app.exit / 未捕获异常等没有执行清理流程的退出路径。
   * 'exit' 回调只允许同步操作，kill 发信号后立即返回
   */
  private static registerExitHook() {
    if (this.exitHookRegistered) return;
    this.exitHookRegistered = true;
    process.on("exit", () => {
      const instance = Store.instance;
      if (!instance?._running) return;
      try {
        instance.serverProc.kill(process.platform === "win32" ? "SIGINT" : "SIGTERM");
      } catch {
        // 进程可能已自行退出，忽略
      }
    });
  }

  get pid() {
    return this.serverProc.pid!;
  }

  private constructor(
    process:
      | ChildProcessByStdio<Writable, null, null> // ["pipe","ignore","ignore"]
      | ChildProcessByStdio<Writable, Readable, Readable>, // ["pipe","pipe","pipe"]
    props: {
      port: number;
      token: string;
      enableConsole: boolean;
      logger: NormalFunc<[msg: Buffer]>;
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

  static handleArgs(args: Record<string, null | number | string>): string[] {
    return Object.entries(args)
      .filter((a): a is [string, number | string] => a[1] !== null)
      .map(([flag, value]) => [flag.startsWith("--") ? flag : `--${flag}`, String(value)])
      .flat();
  }

  static run(props: {
    port: number;
    token: string;
    indexKey: string;
    storePath: Nullable<string>;
    args?: Record<string, null | number | string>;
    /** eg: "24h" */
    path?: string;
    ttl: Nullable<string>;
    enableConsole?: boolean;
    capacity: Nullable<number>;
    logger?: NormalFunc<[msg: Buffer]>;
    onExit?: NormalFunc<[code?: number]>;
  }) {
    if (this.instance) return this.instance;

    props.args = {
      ...props.args,
      port: props.port,
      key: props.token,
      ttl: props.ttl,
      path: props.storePath,
      capacity: props.capacity,
      "index-key": props.indexKey
    };
    props.path ||= defaultServerPath;
    props.logger ||= (b: Buffer) => console.log("[store service stdout]", b.toString());
    props.enableConsole ??= true;

    if (!existsSync(props.path)) {
      throw new Error(`executable file not found: ${props.path}`);
    }

    // stdin 保持 pipe：配合 --watch-parent，父进程以任何方式退出（含被强杀）后
    // 管道关闭，服务端读到 EOF 会自行优雅退出，避免残留孤儿进程
    const spawnArgs = [...Store.handleArgs(props.args), "--watch-parent=true"];
    let serverProc;
    if (props.enableConsole) {
      serverProc = spawn(props.path, spawnArgs, {
        stdio: ["pipe", "pipe", "pipe"]
      });
    } else {
      serverProc = spawn(props.path, spawnArgs, {
        stdio: ["pipe", "ignore", "ignore"]
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
    this.registerExitHook();

    return this.instance;
  }
}
