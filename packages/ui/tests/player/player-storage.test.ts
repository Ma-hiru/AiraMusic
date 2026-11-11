import { RendererPlayerStorage } from "@mahiru/ui/wins/main/lib/player-storage";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@mahiru/ipc/renderer", () => ({
  RendererIPC: { NormalChannel: { send } }
}));

beforeEach(() => {
  localStorage.clear();
  send.mockReset();
  vi.stubGlobal("__TAURI_INTERNALS__", {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("saves a large snapshot through the host even when localStorage writes fail", async () => {
  const snapshot = { playlist: "x".repeat(6 * 1024 * 1024), audio: { currentTime: 123.5 } };
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage quota exceeded", "QuotaExceededError");
  });
  send.mockResolvedValue({ ok: true });
  await RendererPlayerStorage.save(snapshot);
  expect(send).toHaveBeenCalledWith("invoke_store_set", { key: "app_player", value: snapshot });
  send.mockResolvedValue({ ok: true, value: snapshot });
  expect(await RendererPlayerStorage.load()).toEqual(snapshot);
});

it("keeps the old browser snapshot until the host confirms the new write", async () => {
  const old = { track: 1 };
  localStorage.setItem("app_player", JSON.stringify(old));
  let finish!: (value: { ok: true }) => void;
  send.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  let completed = false;
  const saving = RendererPlayerStorage.save({ track: 2 }).then(() => (completed = true));
  await Promise.resolve();
  expect(completed).toBe(false);
  expect(JSON.parse(localStorage.getItem("app_player")!)).toEqual(old);
  finish({ ok: true });
  await saving;
  expect(localStorage.getItem("app_player")).toBeNull();
});

it("rejects failed writes and retains the legacy snapshot", async () => {
  localStorage.setItem("app_player", '{"track":1}');
  send.mockResolvedValue({ ok: false, reason: "disk full" });
  await expect(RendererPlayerStorage.save({ track: 2 })).rejects.toThrow("disk full");
  expect(localStorage.getItem("app_player")).toBe('{"track":1}');
  send.mockRejectedValue(new Error("IPC disconnected"));
  await expect(RendererPlayerStorage.save({ track: 3 })).rejects.toThrow("IPC disconnected");
});

it("loads the legacy browser snapshot when no native snapshot exists", async () => {
  localStorage.setItem("app_player", '{"track":1}');
  send.mockResolvedValue({ ok: true, value: null });
  expect(await RendererPlayerStorage.load()).toEqual({ track: 1 });
});

it("continues using browser storage in Electron", async () => {
  Reflect.deleteProperty(globalThis, "__TAURI_INTERNALS__");
  await RendererPlayerStorage.save({ track: 2 });
  expect(await RendererPlayerStorage.load()).toEqual({ track: 2 });
  expect(send).not.toHaveBeenCalled();
});
