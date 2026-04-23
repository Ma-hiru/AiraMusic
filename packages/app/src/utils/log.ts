import { createLog, LoggerWriter, LogLevel, ParseLogLevel, Log } from "@mahiru/log";
import { isDev } from "./dev";
import { createWriteStream, mkdirSync } from "node:fs";
import { appPathJoin, appUserDataJoin } from "./path";
import { join } from "node:path";

class LoggerFileWriter implements LoggerWriter {
  now;
  dir;
  fileName;
  path;
  stream;

  constructor() {
    this.now = new Date();
    this.dir = isDev ? appPathJoin("logs") : appUserDataJoin("logs");
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

type ExtendLog = Log & {
  EnvLevel: LogLevel;
};

const Log = <ExtendLog>(
  createLog(process.env.APP_LOG_LEVEL, isDev ? console : new LoggerFileWriter(), true)
);

Log.EnvLevel = ParseLogLevel(process.env.APP_LOG_LEVEL);

export { Log, type ExtendLog };
