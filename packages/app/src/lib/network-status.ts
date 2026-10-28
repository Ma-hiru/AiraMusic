import { Resolver } from "node:dns/promises";
import Net from "node:net";
import Https from "node:https";

let pending: undefined | Promise<NetworkStatus>;

export function getNetworkStatus(): Promise<NetworkStatus> {
  return (pending ??= probeNetworkStatus().finally(() => {
    pending = undefined;
  }));
}

export function probeNetworkStatus(timeoutMs = 5_000): Promise<NetworkStatus> {
  return new Promise((resolve) => {
    const hostname = "www.baidu.com";
    const resolver = new Resolver();
    let stage: NetworkStatus = "dns_error";
    let finished = false;
    let socket: undefined | Net.Socket;
    let request: undefined | ReturnType<typeof Https.request>;
    const finish = (status: NetworkStatus) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolver.cancel();
      socket?.destroy();
      request?.destroy();
      resolve(status);
    };
    // 同一个截止时间覆盖 DNS、连接和 TLS，超时后也要释放底层资源。
    const timer = setTimeout(() => finish(stage), timeoutMs);
    void (async () => {
      try {
        const [address] = await resolver.resolve4(hostname);
        if (finished) return;
        if (!address) return finish("dns_error");
        stage = "tcp_error";
        socket = Net.createConnection({ host: address, port: 443 });
        socket.once("error", () => finish("tcp_error"));
        socket.once("connect", () => {
          socket?.destroy();
          if (finished) return;
          stage = "tls_error";
          try {
            request = Https.request(
              {
                hostname,
                method: "HEAD",
                family: 4,
                // 复用已解析的地址，避免 HTTPS 再发起无法随本次探针清理的 DNS 请求。
                lookup: (_hostname, _options, callback) => callback(null, address, 4),
                agent: false
              },
              (response) => {
                response.once("error", () => finish("tls_error"));
                // 收到 HTTPS 响应头即可确认探针可达，HTTP 状态不影响联网判定
                finish("ok");
                response.resume();
              }
            );
            request.once("error", () => finish("tls_error"));
            request.end();
          } catch {
            finish("tls_error");
          }
        });
      } catch {
        finish(stage);
      }
    })();
  });
}
