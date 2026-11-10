import { it, expect, describe } from "vitest";
import { NeteaseURL } from "@mahiru/ui/common/netease/models/netease-url";

describe("NeteaseURL.toSecure", () => {
  it("把公网 http 升级为 https，且不改写查询串", () => {
    // 真实音频地址带签名参数，逐字节必须保留，否则 CDN 会拒绝
    const signed =
      "http://m801.music.126.net/20261109/obj/x.mp3?vuutv=ShJQzPQzY/+w3MXdPFhfNB8SpHa=";
    const secure = NeteaseURL.toSecure(signed);
    expect(secure.startsWith("https://")).toBe(true);
    expect(secure.slice("https://".length)).toBe(signed.slice("http://".length));
  });

  it("封面地址同样升级并保留尺寸参数", () => {
    expect(NeteaseURL.toSecure("http://p3.music.126.net/x.jpg?param=500y500&type=webp")).toBe(
      "https://p3.music.126.net/x.jpg?param=500y500&type=webp"
    );
  });

  it("https 与相对路径、空值保持原样", () => {
    for (const url of ["https://p1.music.126.net/x.jpg", "/api/song/url", "", undefined]) {
      expect(NeteaseURL.toSecure(url as string)).toBe(url);
    }
  });

  it("回环地址不升级：本地服务没有 TLS", () => {
    const loopback = [
      "http://localhost:8827/x",
      "http://127.0.0.1:3000/a.mp3",
      "http://[::1]:3000/x",
      "http://a.localhost:1/x",
      // 解析器会把简写与十进制 IPv4 规整成 127.0.0.1
      "http://127.1:3000/x",
      "http://2130706433:3000/x"
    ];
    for (const url of loopback) expect(NeteaseURL.toSecure(url)).toBe(url);
  });

  it("非法地址原样返回，不抛错", () => {
    expect(NeteaseURL.toSecure("http://")).toBe("http://");
  });
});
