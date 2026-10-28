import { MainServicesBase, type MainServicesCreator } from "../../src/lib/service";
import { MainServicesInstance, type MainServicesName } from "../../src/types/service";

vi.mock("../../src/lib/log", () => ({
  Log: {
    debug: vi.fn(),
    format: (title: string, err: unknown) =>
      `${title}: ${err instanceof Error ? err.message : String(err)}`
  },
  runWithLogContext: <T>(_context: unknown, callback: () => T) => callback()
}));

class Services extends MainServicesBase {
  protected creators: Record<MainServicesName, MainServicesCreator>;
  protected async resolvePort() {
    return { ncm: 1, proxy: 2, store: 3, agent: 0 };
  }
  constructor(creators: Record<MainServicesName, MainServicesCreator>, onError = vi.fn()) {
    super({ services: ["store"], onPanic: onError });
    this.creators = creators;
  }
}
class TestService extends MainServicesInstance {
  readonly ready: NormalFunc<[], Promise<void>>;
  readonly stop = vi.fn(async () => {});

  constructor(
    name: MainServicesName,
    ready: NormalFunc<[], Promise<void>> = vi.fn(async () => {})
  ) {
    super({ name, onPanic: vi.fn(), logger: vi.fn() });
    this.ready = ready;
  }
}

const service = (name: MainServicesName, ready?: NormalFunc<[], Promise<void>>) =>
  new TestService(name, ready);
function setup(agent: MainServicesInstance, store = service("store")) {
  const creators = {
    store: vi.fn(() => store),
    agent: vi.fn(() => agent),
    ncm: vi.fn(),
    proxy: vi.fn()
  };
  const onError = vi.fn();
  return { manager: new Services(creators, onError), creators, onError, store };
}

describe("MainServices 可选服务生命周期", () => {
  it("MCP 等外部依赖就绪后可启动 Agent，并发调用共用一次创建", async () => {
    const gate = Promise.withResolvers<void>();
    const agent = service(
      "agent",
      vi.fn(() => gate.promise)
    );
    const { manager, creators } = setup(agent);
    await manager.ready();
    expect(creators.agent).not.toHaveBeenCalled();
    const first = manager.startService("agent");
    expect(manager.startService("agent")).toBe(first);
    await vi.waitFor(() => expect(agent.ready).toHaveBeenCalledOnce());
    gate.resolve();
    await first;
    expect(manager.getInstance("agent")).toBe(agent);
    expect(manager.services).toEqual(["store", "agent"]);
    expect(creators.agent).toHaveBeenCalledExactlyOnceWith({
      ncm: 1,
      proxy: 2,
      store: 3,
      agent: 0
    });
  });

  it("启动中退出直接停止已创建子进程，无需等待 ready", async () => {
    const gate = Promise.withResolvers<void>();
    const agent = service(
      "agent",
      vi.fn(() => gate.promise)
    );
    const { store, manager } = setup(agent);
    const started = manager.startService("agent");
    await vi.waitFor(() => expect(agent.ready).toHaveBeenCalled());
    const cancelled = expect(started).rejects.toThrow("Services stopped during startup");
    const stopping = manager.stopAll();
    expect(manager.stopAll()).toBe(stopping);
    await Promise.all([cancelled, stopping]);
    expect(agent.stop).toHaveBeenCalledOnce();
    expect(store.stop).toHaveBeenCalledOnce();
    gate.resolve();
  });

  it("默认服务从未 ready 时也能退出，并将启动取消向上传递", async () => {
    const store = service(
      "store",
      vi.fn(() => new Promise<void>(() => {}))
    );
    const { onError, manager } = setup(service("agent"), store);
    await vi.waitFor(() => expect(store.ready).toHaveBeenCalledOnce());
    const cancelled = expect(manager.ready()).rejects.toThrow("Services stopped during startup");
    await manager.stopAll();
    await cancelled;
    expect(store.stop).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("退出时尚未完成端口解析的服务不会延迟创建", async () => {
    const ports = Promise.withResolvers<Record<MainServicesName, number>>();
    const { manager, creators } = setup(service("agent"));
    await manager.ready();
    const resolvePort = vi.spyOn(manager as any, "resolvePort").mockReturnValue(ports.promise);
    const started = manager.startService("agent");
    const cancelled = expect(started).rejects.toThrow("Services stopped during startup");
    await vi.waitFor(() => expect(resolvePort).toHaveBeenCalledOnce());
    await manager.stopAll();
    await cancelled;
    ports.resolve({ ncm: 1, proxy: 2, store: 3, agent: 0 });
    await Promise.resolve();
    expect(creators.agent).not.toHaveBeenCalled();
  });

  it("单独停止尚在等待默认依赖的可选服务不会在之后创建它", async () => {
    const ready = Promise.withResolvers<void>();
    const store = service(
      "store",
      vi.fn(() => ready.promise)
    );
    const { manager, creators } = setup(service("agent"), store);
    const started = manager.startService("agent");
    const cancelled = expect(started).rejects.toThrow("agent service start cancelled");
    await manager.stopService("agent");
    await cancelled;
    ready.resolve();
    await manager.ready();
    expect(creators.agent).not.toHaveBeenCalled();
    await manager.stopAll();
  });

  it("默认服务启动失败时 ready 拒绝并且只上报一次", async () => {
    const store = service(
      "store",
      vi.fn(async () => {
        throw new Error("store not ready");
      })
    );
    const { onError, manager } = setup(service("agent"), store);
    await expect(manager.ready()).rejects.toThrow("store not ready");
    expect(store.stop).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      "store",
      expect.objectContaining({ message: "service ready error: store not ready" })
    );
    await manager.stopAll();
    expect(store.stop).toHaveBeenCalledOnce();
  });

  it("启动失败后的清理即使不完成也会即时拒绝 ready 和报告错误", async () => {
    const store = service(
      "store",
      vi.fn(async () => {
        throw new Error("store failed");
      })
    );
    store.stop.mockImplementation(() => new Promise<void>(() => {}));
    const { onError, manager } = setup(service("agent"), store);
    await expect(manager.ready()).rejects.toThrow("store failed");
    expect(onError).toHaveBeenCalledOnce();
    expect(store.stop).toHaveBeenCalledOnce();
  });

  it("失败时清理 Agent 并保留其他服务", async () => {
    const agent = service(
      "agent",
      vi.fn(async () => {
        throw new Error("not ready");
      })
    );
    const { onError, store, manager } = setup(agent);
    await expect(manager.startService("agent")).rejects.toThrow("not ready");
    expect(agent.stop).toHaveBeenCalledOnce();
    expect(manager.getInstance("agent")).toBeNull();
    expect(manager.getInstance("store")).toBe(store);
    expect(store.stop).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ message: "service ready error: not ready" })
    );
  });
});
