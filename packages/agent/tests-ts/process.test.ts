import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Agent } from "../index";

const fixture = fileURLToPath(new URL("./fixtures/fake-agent.mjs", import.meta.url));

describe("Agent process wrapper", () => {
  const running = new Set<Agent>();

  afterEach(async () => {
    await Promise.allSettled([...running].map((agent) => agent.stop(500)));
    running.clear();
  });

  it("starts from one readiness record and authenticates control requests", async () => {
    const agent = await startFixture();
    running.add(agent);

    expect(agent.running).toBe(true);
    expect(agent.pid).toBeTypeOf("number");
    expect(agent.endpoint).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    await expect(agent.health()).resolves.toEqual({ status: "ready", protocolVersion: 1 });
    await expect(agent.listThreads()).resolves.toEqual([]);

    const unauthenticated = await fetch(`${agent.endpoint}/health`);
    expect(unauthenticated.status).toBe(401);
  });

  it("decodes canonical AG-UI events from SSE", async () => {
    const agent = await startFixture();
    running.add(agent);
    const events = agent.events()[Symbol.asyncIterator]();

    await expect(events.next()).resolves.toEqual({
      done: false,
      value: {
        type: "RUN_STARTED",
        threadId: "thread-1",
        runId: "run-1"
      }
    });
    await events.return?.();
  });

  it("rejects a child that does not become ready and terminates it", async () => {
    await expect(
      startFixture({ execArgs: [fixture, "--never-ready"], startupTimeoutMs: 50 })
    ).rejects.toThrow("Agent 启动超时");
  });

  it("requests graceful shutdown and observes process exit", async () => {
    const agent = await startFixture();
    running.add(agent);

    await expect(agent.stop(1_000)).resolves.toBe(true);
    expect(agent.running).toBe(false);
    running.delete(agent);
  });

  it("passes the log level and decodes structured stderr records", async () => {
    const records: unknown[] = [];
    const agent = await startFixture({
      logLevel: "WARN",
      logger: (record) => records.push(record)
    });
    running.add(agent);

    await vi.waitFor(() =>
      expect(records).toEqual([
        {
          level: "INFO",
          message: "fixture ready",
          target: "fake_agent",
          fields: { configured_level: "WARN" }
        }
      ])
    );
  });
});

function startFixture(overrides: Partial<Parameters<typeof Agent.run>[0]> = {}) {
  return Agent.run({
    port: 0,
    execPath: process.execPath,
    execArgs: [fixture],
    dataDir: "D:/agent-data",
    mcpUrl: "http://127.0.0.1:32123/mcp",
    controlToken: "control-secret",
    storeSecret: "store-secret",
    mcpToken: "mcp-secret",
    logLevel: "INFO",
    startupTimeoutMs: 2_000,
    ...overrides
  });
}
