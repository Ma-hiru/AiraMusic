import { openListeningFootprintDisplay } from "@mahiru/ui/wins/main/lib/open-listening-footprint-display";

const mocks = vi.hoisted(() => ({ ready: vi.fn(), deliver: vi.fn() }));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: { display: { reactReadyAwait: mocks.ready } }
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: { display: { deliver: mocks.deliver } }
}));

beforeEach(() => vi.resetAllMocks());

it("opens display with the selected period and day only after it is ready", async () => {
  const ready = Promise.withResolvers<void>();
  mocks.ready.mockReturnValue(ready.promise);
  const scope = { period: "month" as const, day: "2026-11-03" };
  const opening = openListeningFootprintDisplay(scope);
  expect(mocks.deliver).not.toHaveBeenCalled();
  ready.resolve();
  await opening;
  expect(mocks.deliver).toHaveBeenCalledExactlyOnceWith({ type: "listening-footprint", ...scope });
});

it("does not send a navigation action if display fails to open", async () => {
  mocks.ready.mockRejectedValue(new Error("unavailable"));
  await expect(openListeningFootprintDisplay({ period: "today" })).rejects.toThrow("unavailable");
  expect(mocks.deliver).not.toHaveBeenCalled();
});
