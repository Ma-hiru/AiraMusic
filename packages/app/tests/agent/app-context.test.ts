import { EventEmitter } from "node:events";
import { MainAgentContext } from "@mahiru/app/lib/agent/context";
import { AgentToolAppContext } from "@mahiru/app/inner/agent/tools/inner";
import type { BrowserWindow } from "electron";
import type { ForwardChecker } from "@mahiru/ipc/types";

const mocks = vi.hoisted(() => ({
  windows: new Map<string, unknown>(),
  checker: undefined as undefined | ForwardChecker<any>,
  remove: vi.fn(),
  add: vi.fn()
}));

vi.mock("@mahiru/ipc/main", () => ({ MainIPC: {} }));
vi.mock("@mahiru/app/lib/web-search", () => ({ WebBrowser: {} }));
vi.mock("@mahiru/app/lib/bangumi", () => ({ BangumiAPI: {} }));
const windows = {
  get: (type: string) => (mocks.windows.get(type) ?? null) as null | BrowserWindow,
  getId: (window: BrowserWindow) =>
    ([...mocks.windows].find(([, candidate]) => candidate === window)?.[0] ??
      null) as null | WindowType
};

class ContextWindow extends EventEmitter {
  focused = false;
  visible = true;
  minimized = false;

  isFocused() {
    return this.focused;
  }

  isVisible() {
    return this.visible;
  }

  isMinimized() {
    return this.minimized;
  }

  focus() {
    this.focused = true;
    this.emit("focus");
  }
}

function createWindow(type: string) {
  const window = new ContextWindow();
  mocks.windows.set(type, window);
  return window;
}

function deliver(window: ContextWindow, data: unknown, type = "bus_deliver_focus_context") {
  return mocks.checker!(window as unknown as BrowserWindow, { type, data, to: "process" } as never);
}

function subscribe(checker: ForwardChecker<any>) {
  mocks.add();
  mocks.checker = checker;
  return mocks.remove;
}

beforeEach(() => {
  MainAgentContext[Symbol.dispose]();
  mocks.windows.clear();
  vi.clearAllMocks();
  MainAgentContext.init(subscribe, windows);
});

afterEach(() => MainAgentContext[Symbol.dispose]());

it("keeps the last focused resource when Agent takes focus and background pages finish loading", () => {
  const main = createWindow("main");
  const display = createWindow("display");
  main.focus();
  deliver(main, { page: "home" });
  deliver(display, { page: "album", id: 10, name: "专辑加载中" });
  expect(MainAgentContext.snapshot()).toMatchObject({ window: "main", page: { page: "home" } });

  main.focused = false;
  display.focus();
  display.focused = false;
  deliver(main, { page: "search", keyword: "后台搜索" });
  deliver(display, { page: "album", id: 10, name: "当前专辑" });
  expect(MainAgentContext.snapshot()).toMatchObject({
    window: "display",
    page: { page: "album", id: 10, name: "当前专辑" }
  });
});

it("does not retain hidden, minimized or replaced windows as the current page", () => {
  const main = createWindow("main");
  const display = createWindow("display");
  deliver(main, { page: "home" });
  display.focus();
  deliver(display, { page: "playlist", id: 11, name: "当前歌单", source: "normal" });
  display.focused = false;
  display.visible = false;
  expect(MainAgentContext.snapshot().window).toBe("main");
  display.visible = true;
  display.minimized = true;
  expect(MainAgentContext.snapshot().window).toBe("main");

  createWindow("display");
  expect(MainAgentContext.snapshot().window).toBe("main");
  deliver(main, { page: "hidden" });
  expect(MainAgentContext.snapshot().page).toBeNull();
  expect(main.listenerCount("focus")).toBe(0);
});

it("only accepts registered application context windows and bounded resource identifiers", () => {
  const display = createWindow("display");
  const agent = createWindow("agent");
  deliver(display, { page: "artist", id: 12, name: "艺人" });
  deliver(agent, { page: "album", id: 999, name: "伪造页面" });
  deliver(display, { page: "album", id: 0, name: "无效资源" });
  expect(MainAgentContext.snapshot().page).toEqual({ page: "artist", id: 12, name: "艺人" });
  deliver(display, { page: "search", keyword: "x".repeat(513) });
  expect(MainAgentContext.snapshot().page).toEqual({ page: "search", keyword: "x".repeat(512) });
  deliver(display, { page: "playlist", id: 123, source: "user-liked-track", name: "我喜欢的音乐" });
  expect(MainAgentContext.snapshot().page).toMatchObject({ id: 123, source: "user-liked-track" });
});

it("supplies comments and lightweight playback context through a read-only main-process tool", async () => {
  const main = createWindow("main");
  const comments = createWindow("comments");
  deliver(
    main,
    { track: { id: 20, name: "正在播放", detail: { ar: [{ name: "歌手" }], secret: "private" } } },
    "bus_deliver_track_meta"
  );
  comments.focus();
  deliver(comments, { page: "comments", id: 21, type: "album" });
  expect(AgentToolAppContext.execution).toBe("main");
  expect(AgentToolAppContext.risk).toBe("read");
  expect(await AgentToolAppContext.execute({})).toEqual({
    window: "comments",
    page: { page: "comments", id: 21, type: "album" },
    currentTrack: { id: 20, name: "正在播放", artists: ["歌手"] }
  });

  const copy = MainAgentContext.snapshot();
  copy.currentTrack!.name = "外部修改";
  expect(MainAgentContext.snapshot().currentTrack!.name).toBe("正在播放");
  createWindow("main");
  expect(MainAgentContext.snapshot().currentTrack).toBeNull();
});

it("initializes once and removes window focus subscriptions on shutdown", () => {
  MainAgentContext.init(subscribe, windows);
  expect(mocks.add).toHaveBeenCalledOnce();
  const display = createWindow("display");
  deliver(display, { page: "search", keyword: "查询" });
  expect(display.listenerCount("focus")).toBe(1);
  MainAgentContext[Symbol.dispose]();
  expect(display.listenerCount("focus")).toBe(0);
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(MainAgentContext.snapshot()).toEqual({ window: null, page: null, currentTrack: null });
});
