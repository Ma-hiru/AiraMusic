import { EventSchemas, type AGUIEvent } from "@ag-ui/core";

export async function* decodeAgentEvents(
  url: string,
  headers: Headers,
  signal?: AbortSignal
): AsyncGenerator<AGUIEvent> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Agent 事件流连接失败 (${response.status})`);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true }).replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) yield EventSchemas.parse(JSON.parse(data));
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}
