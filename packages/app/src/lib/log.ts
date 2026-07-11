import { join } from "node:path";
import { mkdirSync, createWriteStream } from "node:fs";
import { getArgValue } from "@/utils/args";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import {
  LogLevel,
  createLog,
  ParseLogLevel,
  type LoggerWriter,
  type Log as LogInstance
} from "@mahiru/log";

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

const level = ParseLogLevel(getArgValue("log-level") || process.env.APP_LOG_LEVEL);

const Log = <ExtendLog>createLog(level, MainRuntime.isDev ? console : new LoggerFileWriter(), true);

Log.EnvLevel = level;

export { Log, type ExtendLog };
