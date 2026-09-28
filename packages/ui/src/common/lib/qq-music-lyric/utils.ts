import { RendererNet } from "@/common/lib/net";

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // 将字节序列编码为 Base64 ASCII 字符串
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** JS 字符串 → UTF-8 字节 → Base64 */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return base64(bytes);
}

/** Base64 → 字节 → 按 UTF-8 解码为 JS 字符串 */
export function base64ToText(base64: string): string {
  const bytes = fromBase64(base64);
  return new TextDecoder().decode(bytes);
}

/**
 * 通用 musicu.fcg POST
 */
export async function requestMusicuFcg<T>(body: JsonValue): Promise<T> {
  const res = await RendererNet.requestFromNode("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Referer: "https://y.qq.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/140.0.0.0 Safari/537.36"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
