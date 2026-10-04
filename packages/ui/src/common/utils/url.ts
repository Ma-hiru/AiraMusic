import { Log } from "@/common/lib/log";

export function isLocalhostHttpURL(
  url: unknown
): url is
  | `http://127.0.0.1${string}`
  | `http://localhost${string}`
  | `https://127.0.0.1${string}`
  | `https://localhost${string}` {
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch (e) {
    Log.error(e);
    return false;
  }
}
