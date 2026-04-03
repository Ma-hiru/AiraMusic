import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { ChildProcessByStdio, spawn } from "node:child_process";
import { Readable } from "node:stream";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const exeName = process.platform === "win32" ? "server.exe" : "server";
const defaultServerPath = join(__dirname, "dist", exeName);

export default class Store {
  private applicationPath;
  private serverProc;
  private enableConsole;
  private _running;
  private _logger;
  private _exitHandler = new Set<NormalFunc<[code: Nullable<number>]>>();
  private _errorHandler = new Set<NormalFunc<[err: Error]>>();
  private static instance: Nullable<Store> = null;

  stop() {
    return this.serverProc.kill("SIGTERM");
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
      path: string;
      enableConsole: boolean;
      logger: NormalFunc<[msg: Buffer]>;
    }
  ) {
    this.serverProc = process;
    this._running = true;
    this.applicationPath = props.path;
    this.enableConsole = props.enableConsole;
    this._logger = props.logger;
    this.init();
  }

  private init() {
    this.serverProc.on("exit", (code) => {
      if (this.enableConsole && this._logger) {
        this._logger(Buffer.from("server exited: " + code));
      } else {
        console.warn("server exited", code);
      }
      this._running = false;
      this.stop();
      for (const handler of this._exitHandler) {
        try {
          handler(code);
        } catch (err) {
          console.error("error in exit handler", err);
        }
      }
      this._exitHandler.clear();
    });

    this.serverProc.on("error", (err) => {
      if (this.enableConsole && this._logger) {
        this._logger(Buffer.from("server error: " + err.message));
      } else {
        console.error("server error", err);
      }
      this._running = false;
      this.stop();
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

    this.instance = new Store(serverProc, {
      path: props.path,
      enableConsole: props.enableConsole,
      logger: props.logger
    });

    return this.instance;
  }
}
