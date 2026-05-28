import net from "node:net";
import type { MainServicesType } from "@/types/service";
import { Log } from "@/lib/log";

export class MainPortResolver {
  private static readonly stored = new Map<MainServicesType, number>();

  static valid(port: number) {
    return Number.isInteger(port) && port > 0 && port <= 65535;
  }

  static parse(value: Optional<string | number>) {
    const port = Number(value);
    if (!this.valid(port)) throw new Error(`parse port error, port=${value}`);
    return port;
  }

  static available(port: number, host = "127.0.0.1") {
    if (!this.valid(port)) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const server = net.createServer();
      const cleanup = () => server.removeAllListeners();

      server.once("error", () => {
        cleanup();
        resolve(false);
      });

      server.once("listening", () => {
        server.close(() => {
          cleanup();
          resolve(true);
        });
      });

      server.listen({
        port,
        host,
        exclusive: true
      });
    });
  }

  static async resolve(name: MainServicesType, candidates: Iterable<number> & { host?: string }) {
    if (this.stored.get(name)) return this.stored.get(name)!;
    Log.debug("port", name, "no stored port, then use candidates");
    for (const port of candidates) {
      Log.debug("port", name, "get candidate =", port);
      if (await this.available(port, candidates.host ?? "127.0.0.1")) {
        Log.debug("port", name, "find port", port);
        this.stored.set(name, port);
        return port;
      } else {
        Log.debug("port", name, "candidate port can't use, port =", port);
      }
    }

    throw new Error("no available port found from candidates");
  }

  static candidates(props: {
    preferred: number;
    host?: string;
    gap: number;
    count: number;
  }): Iterable<number> & { host?: string } {
    const { preferred, gap, count, host } = props;
    return {
      host,
      [Symbol.iterator]() {
        let i = 0;
        return {
          next() {
            if (i++ === 0) {
              return {
                value: preferred,
                done: !MainPortResolver.valid(preferred)
              };
            }
            const value = preferred + gap * i;
            return {
              value,
              done: i === count || MainPortResolver.valid(value)
            };
          }
        };
      }
    };
  }
}
