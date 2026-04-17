import { LoggerWriter } from "@mahiru/log";

export class ProcessLogger implements LoggerWriter {
  write(input: { type: string; text: string }) {
    input.text = input.text + " (renderer)";
    requestIdleCallback(() => {
      window
        .fetch("/log", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        })
        .catch((err) => {
          console.error("Failed to send log to main process:", err);
        });
    });
  }

  log(input: string) {
    this.write({ type: "log", text: input });
  }
  warn(input: string) {
    this.write({ type: "warn", text: input });
  }
  error(input: string) {
    this.write({ type: "error", text: input });
  }
  trace(input: string) {
    this.write({ type: "trace", text: input });
  }
  debug(input: string) {
    this.write({ type: "debug", text: input });
  }
}
