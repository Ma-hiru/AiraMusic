import { openPlayListDisplay } from "@mahiru/ui/wins/main/lib/open-play-list-display";

const mocks = vi.hoisted(() => ({ ready: vi.fn(), deliver: vi.fn() }));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: { display: { reactReadyAwait: mocks.ready } }
}));
vi.mock("@/common/lib/bus", () => ({
  RendererIPCMessageBus: { display: { deliver: mocks.deliver } }
}));

afterEach(() => vi.clearAllMocks());

it("waits for the display renderer before requesting its queue page and leaves the main route intact", async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  mocks.ready.mockReturnValue(promise);
  const previous = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", "/playlist?id=42&source=normal");
  try {
    const opening = openPlayListDisplay();
    expect(mocks.ready).toHaveBeenCalledOnce();
    expect(mocks.deliver).not.toHaveBeenCalled();
    resolve();
    await opening;
    expect(mocks.deliver).toHaveBeenCalledExactlyOnceWith({ type: "play-list" });
    expect(window.location.pathname + window.location.search).toBe("/playlist?id=42&source=normal");
  } finally {
    window.history.replaceState(null, "", previous);
  }
});

it("does not send a page request when display startup fails", async () => {
  mocks.ready.mockRejectedValue(new Error("display unavailable"));
  await expect(openPlayListDisplay()).rejects.toThrow("display unavailable");
  expect(mocks.deliver).not.toHaveBeenCalled();
});
