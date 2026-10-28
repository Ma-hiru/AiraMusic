import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { lookup as dnsLookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

import { WebBrowserError } from "./web-browser-error";

export type WebHostLookup = (
  hostname: string
) => Promise<Array<{ family: number; address: string }>>;

const LocalHostnames = ["localhost", "local", "internal", "lan", "home.arpa"];
const GlobalIPv6 = ipaddr.IPv6.parse("2000::");

export function normalizeWebHostname(hostname: string): string {
  return hostname.trim().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
}

/** 地址解析、保留网段和 IPv4 映射识别由 ipaddr.js 提供。 */
export function isBlockedWebAddress(address: string, family = isIP(address)): boolean {
  if (!family || isIP(address) !== family) return true;
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.range() !== "unicast") return true;
    if (parsed.kind() === "ipv6" && !(parsed as ipaddr.IPv6).match(GlobalIPv6, 3)) return true;
    const key = parsed.toNormalizedString();
    // 网卡也可能绑定公网 IP，不能仅依赖私网分类。
    return Object.values(networkInterfaces()).some((entries) =>
      entries?.some(
        (entry) => ipaddr.parse(entry.address.split("%", 1)[0]!).toNormalizedString() === key
      )
    );
  } catch {
    return true;
  }
}

export function parsePublicWebURL(value: URL | string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebBrowserError("invalid_input", "网页 URL 无效");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new WebBrowserError("invalid_input", "只允许访问 HTTP 或 HTTPS 网页");
  if (url.username || url.password)
    throw new WebBrowserError("invalid_input", "网页 URL 不允许包含认证信息");
  const hostname = normalizeWebHostname(url.hostname);
  if (
    LocalHostnames.some((local) => hostname === local || hostname.endsWith(`.${local}`)) ||
    (isIP(hostname) !== 0 && isBlockedWebAddress(hostname))
  )
    throw new WebBrowserError("forbidden", "不允许访问本地、私网或保留地址");
  return url;
}

export async function resolvePublicWebHostname(
  hostname: string,
  lookup: WebHostLookup = (host) => dnsLookup(host, { all: true, verbatim: true })
): Promise<Array<{ family: number; address: string }>> {
  const normalized = normalizeWebHostname(hostname);
  if (
    !normalized ||
    LocalHostnames.some((local) => normalized === local || normalized.endsWith(`.${local}`))
  )
    return [];
  const family = isIP(normalized);
  if (family)
    return isBlockedWebAddress(normalized, family) ? [] : [{ family, address: normalized }];
  try {
    const addresses = await lookup(normalized);
    return addresses.length &&
      !addresses.some((item) => isBlockedWebAddress(item.address, item.family))
      ? addresses
      : [];
  } catch {
    return [];
  }
}

export async function isPublicWebHostname(
  hostname: string,
  lookup?: WebHostLookup
): Promise<boolean> {
  return (await resolvePublicWebHostname(hostname, lookup)).length > 0;
}

export async function assertPublicWebURL(
  value: URL | string,
  lookup?: WebHostLookup
): Promise<URL> {
  const url = parsePublicWebURL(value);
  if (!(await isPublicWebHostname(url.hostname, lookup)))
    throw new WebBrowserError("forbidden", "不允许访问本地、私网、保留地址或无法安全解析的域名");
  return url;
}

export async function canRequestPublicWebURL(
  value: string,
  options: { allowAboutBlank?: boolean } = {}
): Promise<boolean> {
  if (options.allowAboutBlank && value === "about:blank") return true;
  try {
    await assertPublicWebURL(value);
    return true;
  } catch {
    return false;
  }
}
