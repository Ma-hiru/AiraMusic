import { Log } from "@/common/lib/log";

/** 回环主机名：本地服务没有 TLS，协议升级时必须跳过 */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1"
  );
}

export function isLocalhostHttpURL(
  url: unknown
): url is
  | `http://[::1]${string}`
  | `https://[::1]${string}`
  | `http://127.0.0.1${string}`
  | `http://localhost${string}`
  | `https://127.0.0.1${string}`
  | `https://localhost${string}`
  | `http://${string}.localhost${string}`
  | `https://${string}.localhost${string}` {
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  try {
    return isLoopbackHostname(new URL(url).hostname);
  } catch (e) {
    Log.error(e);
    return false;
  }
}
