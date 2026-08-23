import { createServer } from "node:http";

const args = process.argv.slice(2);
if (args.includes("--never-ready")) {
  setInterval(() => {}, 1_000);
} else {
  const valueAfter = (flag) => args[args.indexOf(flag) + 1];
  const requestedPort = Number(valueAfter("--port"));
  const logLevel = valueAfter("--log-level");
  const token = process.env.AIRA_AGENT_CONTROL_TOKEN;
  if (!token || !process.env.AIRA_AGENT_STORE_SECRET || !process.env.AIRA_AGENT_MCP_TOKEN) {
    process.exit(12);
  }

  const server = createServer((request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end();
      return;
    }
    if (request.url === "/health") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ status: "ready", protocolVersion: 1 }));
      return;
    }
    if (request.url === "/v1/threads") {
      response.setHeader("content-type", "application/json");
      response.end("[]");
      return;
    }
    if (request.url === "/v1/events") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache"
      });
      response.write('data: {"type":"RUN_STARTED","threadId":"thread-1","runId":"run-1"}\n\n');
      return;
    }
    if (request.url === "/shutdown" && request.method === "POST") {
      response.writeHead(204).end();
      server.close(() => process.exit(0));
      server.closeAllConnections();
      return;
    }
    response.writeHead(404).end();
  });

  server.listen(requestedPort, "127.0.0.1", () => {
    const address = server.address();
    process.stderr.write(
      `${JSON.stringify({
        timestamp: "2026-08-23T00:00:00Z",
        level: "INFO",
        target: "fake_agent",
        fields: { message: "fixture ready", configured_level: logLevel }
      })}\n`
    );
    process.stdout.write(
      `${JSON.stringify({ type: "ready", port: address.port, protocolVersion: 1 })}\n`
    );
  });

  process.stdin.resume();
  process.stdin.on("end", () => server.close(() => process.exit(0)));
}
