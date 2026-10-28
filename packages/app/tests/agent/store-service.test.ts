import StoreService from "../../src/services/store";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@mahiru/store", () => ({ default: { run: mocks.run } }));

describe("StoreService 退出分类", () => {
  const create = () => {
    let onExit: (code: null | number) => void;
    const instance = {
      stop: vi.fn(async () => {
        onExit(0);
        return true;
      }),
      stopByHttp: vi.fn(async () => true)
    };
    mocks.run.mockImplementation((options) => {
      onExit = options.onExit;
      return instance;
    });
    const onPanicError = vi.fn();
    const service = new StoreService({
      port: 1,
      token: "token",
      storePath: "/data/store",
      indexKey: "index-key",
      ttl: null,
      capacity: null,
      logger: vi.fn(),
      onPanicError
    });
    return { service, instance, onPanicError, exit: (code: null | number) => onExit(code) };
  };

  it.each([0, 1, null])("主动 stop 前退出 code=%s 均报告 panic", (code) => {
    const { onPanicError, exit } = create();
    exit(code);
    expect(onPanicError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: `store service exit with code ${code}` })
    );
  });

  it("主动停止先标记状态，正常退出不报告 panic", async () => {
    const { onPanicError, service, instance } = create();
    const stopping = service.stop();
    expect(service.stop()).toBe(stopping);
    await stopping;
    expect(instance.stop).toHaveBeenCalledOnce();
    expect(onPanicError).not.toHaveBeenCalled();
  });
});
