import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

export type WebHostLookup = (
  hostname: string
) => Promise<Array<{ family: number; address: string }>>;

const IPv4BlockedRanges: ReadonlyArray<readonly [number, number]> = (() => {
  const subnets: ReadonlyArray<readonly [string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4]
  ];
  return subnets.map(([network, prefix]) => ipv4CidrToRange(network, prefix));
})();

const IPv6BlockedRanges: ReadonlyArray<readonly [bigint, number]> = [
  [parseIPv6("::"), 96], // IPv4 兼容地址与未指定地址空间
  [parseIPv6("64:ff9b::"), 96], // NAT64 可能隐藏 IPv4 私网目标
  [parseIPv6("100::"), 64], // 仅丢弃地址
  [parseIPv6("2001::"), 32], // Teredo 隧道地址
  [parseIPv6("2001:2::"), 48], // 性能基准地址
  [parseIPv6("2001:10::"), 28], // ORCHID 地址
  [parseIPv6("2001:20::"), 28], // ORCHIDv2 地址
  [parseIPv6("2001:db8::"), 32], // 文档保留地址
  [parseIPv6("2002::"), 16], // 6to4 可能隐藏 IPv4 私网目标
  [parseIPv6("3fff::"), 20], // 文档保留地址
  [parseIPv6("5f00::"), 16], // 分段路由 SID 地址
  [parseIPv6("fc00::"), 7], // 唯一本地地址
  [parseIPv6("fe80::"), 10], // 链路本地地址
  [parseIPv6("fec0::"), 10], // 已废弃的站点本地地址
  [parseIPv6("ff00::"), 8] // 组播地址
];

const UnsafeHostnameSuffixes = [".localhost", ".local", ".internal", ".lan", ".home.arpa"] as const;

export function normalizeWebHostname(hostname: string): string {
  return hostname.trim().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
}

export function isBlockedWebAddress(address: string, family = isIP(address)): boolean {
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true;
}

export async function isPublicWebHostname(
  hostname: string,
  lookup: WebHostLookup = defaultLookup
): Promise<boolean> {
  return (await resolvePublicWebHostname(hostname, lookup)).length > 0;
}

export async function resolvePublicWebHostname(
  hostname: string,
  lookup: WebHostLookup = defaultLookup
): Promise<Array<{ family: number; address: string }>> {
  const normalized = normalizeWebHostname(hostname);
  if (
    !normalized ||
    normalized === "localhost" ||
    normalized === "local" ||
    normalized === "internal" ||
    normalized === "home.arpa" ||
    UnsafeHostnameSuffixes.some((suffix) => normalized.endsWith(suffix))
  ) {
    return [];
  }

  const family = isIP(normalized);
  if (family !== 0) {
    return isBlockedWebAddress(normalized, family) ? [] : [{ family, address: normalized }];
  }

  try {
    const addresses = await lookup(normalized);
    if (
      addresses.length === 0 ||
      addresses.some(({ family, address }) => isBlockedWebAddress(address, family))
    ) {
      return [];
    }
    return addresses;
  } catch {
    // DNS 解析属于安全边界，解析失败时绝不能绕过地址检查。
    return [];
  }
}

export async function assertPublicWebURL(
  value: URL | string,
  lookup?: WebHostLookup
): Promise<URL> {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value) : new URL(value);
  } catch {
    throw new Error("网页 URL 无效");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只允许访问 HTTP 或 HTTPS 网页");
  }
  if (url.username || url.password) {
    throw new Error("网页 URL 不允许包含认证信息");
  }
  if (!(await isPublicWebHostname(url.hostname, lookup))) {
    throw new Error("不允许访问本地、私网、保留地址或无法安全解析的域名");
  }
  return url;
}

export async function canRequestPublicWebURL(
  value: string,
  lookup?: WebHostLookup
): Promise<boolean> {
  try {
    await assertPublicWebURL(value, lookup);
    return true;
  } catch {
    return false;
  }
}

async function defaultLookup(hostname: string) {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

function isBlockedIPv4(address: string): boolean {
  if (isIP(address) !== 4) return true;
  const value = ipv4ToNumber(address);
  return IPv4BlockedRanges.some(([start, end]) => value >= start && value <= end);
}

function isBlockedIPv6(address: string): boolean {
  const value = parseIPv6(address);

  // IPv4 映射的 IPv6 地址必须沿用其内嵌 IPv4 地址的拦截策略。
  if (value >> 32n === 0xffffn) {
    const mapped = Number(value & 0xffff_ffffn);
    const ipv4 = [24, 16, 8, 0].map((shift) => (mapped >>> shift) & 0xff).join(".");
    return isBlockedIPv4(ipv4);
  }

  return IPv6BlockedRanges.some(([network, prefix]) => ipv6InCidr(value, network, prefix));
}

function ipv4ToNumber(address: string): number {
  const parts = address.split(".").map(Number);
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function ipv4CidrToRange(network: string, prefix: number): readonly [number, number] {
  const networkValue = ipv4ToNumber(network);
  const mask = prefix === 0 ? 0 : (0xffff_ffff << (32 - prefix)) >>> 0;
  const start = (networkValue & mask) >>> 0;
  return [start, (start | ~mask) >>> 0];
}

function parseIPv6(address: string): bigint {
  let normalized = address.toLowerCase();
  const zoneIndex = normalized.indexOf("%");
  if (zoneIndex !== -1) normalized = normalized.slice(0, zoneIndex);

  const ipv4Match = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const ipv4 = ipv4Match[1]!;
    if (isIP(ipv4) !== 4) throw new Error("IPv4 映射的 IPv6 地址无效");
    const value = ipv4ToNumber(ipv4);
    const replacement = `${((value >>> 16) & 0xffff).toString(16)}:${(value & 0xffff).toString(16)}`;
    normalized = normalized.slice(0, -ipv4.length) + replacement;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) throw new Error("IPv6 地址无效");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const zeroCount = halves.length === 2 ? 8 - left.length - right.length : 0;
  const parts = halves.length === 2 ? [...left, ...Array(zeroCount).fill("0"), ...right] : left;
  if (parts.length !== 8 || zeroCount < 0) throw new Error("IPv6 地址无效");

  return parts.reduce((result, part) => {
    if (!/^[0-9a-f]{1,4}$/.test(part)) throw new Error("IPv6 地址无效");
    return (result << 16n) | BigInt(`0x${part}`);
  }, 0n);
}

function ipv6InCidr(value: bigint, network: bigint, prefix: number): boolean {
  if (prefix === 0) return true;
  const shift = BigInt(128 - prefix);
  return value >> shift === network >> shift;
}
