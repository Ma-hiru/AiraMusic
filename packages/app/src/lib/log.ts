import {
  createLog,
  type LoggerWriter,
  LogLevel,
  ParseLogLevel,
  type Log as LogInstance
} from "@mahiru/log";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";

class LoggerFileWriter implements LoggerWriter {
  now;
  dir;
  fileName;
  path;
  stream;

  constructor() {
    this.now = new Date();
    this.dir = MainPathResolver.logDir;
    this.fileName = `${this.now.getFullYear()}-${(this.now.getMonth() + 1).toString().padStart(2, "0")}-${this.now
      .getDate()
      .toString()
      .padStart(2, "0")}_${this.now.getHours().toString().padStart(2, "0")}-${this.now
      .getMinutes()
      .toString()
      .padStart(2, "0")}-${this.now.getSeconds().toString().padStart(2, "0")}.log`;

    mkdirSync(this.dir, { recursive: true });

    this.path = join(this.dir, this.fileName);
    this.stream = createWriteStream(this.path, { flags: "a", encoding: "utf8" });

    process.on("beforeExit", () => {
      this.stream.end();
      this.stream.close();
    });
  }

  write(input: string) {
    this.stream.write(input + "\n");
  }

  log(input: string) {
    this.write(input);
  }

  warn(input: string) {
    this.write(input);
  }

  error(input: string) {
    this.write(input);
  }

  trace(input: string) {
    this.write(input);
  }

  debug(input: string) {
    this.write(input);
  }
}

type ExtendLog = LogInstance & {
  EnvLevel: LogLevel;
};

const Log = <ExtendLog>(
  createLog(process.env.APP_LOG_LEVEL, MainRuntime.isDev ? console : new LoggerFileWriter(), true)
);

Log.EnvLevel = ParseLogLevel(process.env.APP_LOG_LEVEL);

export { Log, type ExtendLog };
