import type { MenuItemConstructorOptions } from "electron";
import type { MessageData } from "@mahiru/ipc/types";

type Template = MenuItemConstructorOptions[];
type Meta = MessageData<"bus_deliver_track_meta">;

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (data: unknown) => void>(),
  commit: vi.fn(),
  setMenu: vi.fn()
}));

vi.mock("electron", () => ({
  app: { dock: { setMenu: mocks.setMenu } },
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => ({ template })
  }
}));
vi.mock("@mahiru/app/lib/log", () => ({ Log: { debug: vi.fn(), warn: vi.fn() } }));
vi.mock("@mahiru/ipc/main", () => ({
  MainIPC: {
    MessageChannel: {
      commit: mocks.commit,
      listen: (channel: string, listener: (data: unknown) => void) => {
        mocks.listeners.set(channel, listener);
      }
    }
  }
}));

const realPlatform = process.platform;
let DockMenu: typeof import("@mahiru/app/lib/dock-menu").MainDockMenu;

/** 最近一次传给 Dock 的模板 */
function lastTemplate(): Template {
  return mocks.setMenu.mock.calls.at(-1)![0].template as Template;
}

function meta(
  status: Meta["status"],
  repeat: Meta["repeat"] = "all",
  shuffle = false,
  mode: Meta["mode"] = "normal"
): Meta {
  return {
    track: { id: 1, name: "Song", sourceID: 0 } as NonNullable<Meta["track"]>,
    repeat,
    shuffle,
    status,
    mode,
    rmActive: false,
    tlActive: false,
    noteActive: false,
    lyric: null,
    playlistMarkId: "test"
  };
}

function deliver(data: Meta) {
  mocks.listeners.get("bus_deliver_track_meta")!(data);
}

beforeAll(() => {
  // Dock 菜单只在 macOS 注册，测试在任意平台都应覆盖到
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
});

afterAll(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.listeners.clear();
  DockMenu = (await import("@mahiru/app/lib/dock-menu")).MainDockMenu;
  DockMenu.register();
});

it("sets a dock menu with playback, repeat and shuffle entries", () => {
  const template = lastTemplate();

  expect(template.map((item) => item.label ?? item.type)).toEqual([
    "播放",
    "下一首",
    "上一首",
    "separator",
    "循环播放",
    "随机播放"
  ]);
  expect(template[4]!.submenu).toHaveLength(3);
  expect(template[5]).toMatchObject({ type: "checkbox", checked: false });
});

it("reflects the current playback state", () => {
  deliver(meta("playing", "one", true));

  const template = lastTemplate();
  expect(template[0]!.label).toBe("暂停");
  expect(template[4]!.submenu).toEqual([
    expect.objectContaining({ label: "循环关闭", checked: false }),
    expect.objectContaining({ label: "单曲循环", checked: true }),
    expect.objectContaining({ label: "列表循环", checked: false })
  ]);
  expect(template[5]).toMatchObject({ checked: true });
});

it("dispatches player actions and repeat modes", () => {
  deliver(meta("playing"));

  const template = lastTemplate();
  template[1]!.click!(undefined as never, undefined as never, undefined as never);
  expect(mocks.commit).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "bus_dispatch_player_action", data: "next" })
  );

  template[0]!.click!(undefined as never, undefined as never, undefined as never);
  expect(mocks.commit).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "bus_dispatch_player_action", data: "play-toggle" })
  );

  const repeatItems = template[4]!.submenu as MenuItemConstructorOptions[];
  repeatItems[1]!.click!(undefined as never, undefined as never, undefined as never);
  expect(mocks.commit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: "bus_dispatch_player_action",
      data: { type: "repeat", mode: "one" }
    })
  );

  template[5]!.click!(undefined as never, undefined as never, undefined as never);
  expect(mocks.commit).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "bus_dispatch_player_action", data: "shuffle-toggle" })
  );
});

it("disables shuffle outside the normal playback mode", () => {
  deliver(meta("playing", "all", true, "fm"));
  expect(lastTemplate()[5]).toMatchObject({ checked: true, enabled: false });

  deliver(meta("playing", "all", true, "normal"));
  expect(lastTemplate()[5]).toMatchObject({ enabled: true });
});

it("skips rebuilding when only unrelated metadata changes", () => {
  const calls = mocks.setMenu.mock.calls.length;
  deliver(meta("playing", "off", false));
  expect(mocks.setMenu.mock.calls.length).toBe(calls + 1);

  deliver(meta("playing", "off", false));
  expect(mocks.setMenu.mock.calls.length).toBe(calls + 1);
});
