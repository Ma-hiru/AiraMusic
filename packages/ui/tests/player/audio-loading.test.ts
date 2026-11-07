import { TrackQuality } from "@mahiru/ui/common/enum";
import {
  NeteaseTrack,
  NeteaseLocalAudio,
  NeteaseTrackRecord,
  NeteaseNetworkAudio
} from "@mahiru/ui/common/netease/models";
import RendererPlayer from "@mahiru/ui/common/player/core";
import RendererPlayerAudio from "@mahiru/ui/common/player/audio";

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  download: vi.fn(),
  idleTasks: [] as AsyncGenerator<unknown, unknown, unknown>[]
}));

vi.mock("@/common/lib/cache", () => ({ RendererCache: {} }));
vi.mock("@/common/store/user", () => ({ userStoreSnapshot: () => ({ _user: null }) }));
vi.mock("@/common/store/settings", () => ({
  settingsStoreSnapshot: () => ({ _settings: { trackQuality: { quality: "standard" } } })
}));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/netease/services/auth", () => ({ Status: {} }));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesAuth: {},
  NeteaseServicesAudio: { track: mocks.track, download: mocks.download },
  NeteaseServicesImage: {},
  NeteaseServicesLyric: {}
}));
vi.mock("@/common/lib/idle", () => ({
  RendererIdle: {
    normal: vi.fn(),
    runAsync: (task: () => AsyncGenerator<unknown, unknown, unknown>) => {
      mocks.idleTasks.push(task());
      return Promise.resolve();
    }
  }
}));

class TestAudio extends EventTarget {
  src = "";
  currentTime = 0;
  duration = 180;
  volume = 1;
  muted = false;
  paused = true;
  crossOrigin = "";
  buffered = { length: 0 };
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    const playing = !this.paused;
    this.paused = true;
    if (playing) this.dispatchEvent(new Event("pause"));
  });
  load = vi.fn();
  remove = vi.fn();
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
}

const fetchMock = vi.fn();
const createObjectURL = vi.fn(() => "blob:cached-audio");
const disposables: { [Symbol.dispose](): void }[] = [];

const track = (id: number) =>
  new NeteaseTrack({
    id,
    name: `Track ${id}`,
    ar: [],
    al: { id, name: `Album ${id}`, picUrl: "https://audio.test/cover.jpg", pic: 0, tns: [] },
    alia: [],
    tns: [],
    dt: 180_000,
    fee: 0,
    mark: 0,
    mv: 0,
    no: 1,
    originCoverType: 0,
    pop: 0,
    publishTime: 0,
    noCopyrightRcmd: null,
    h: null,
    hr: null,
    l: null,
    m: null,
    sq: null,
    privilege: null
  });

const record = (id: number) =>
  new NeteaseTrackRecord({ sourceID: 42, sourceName: "playlist", detail: track(id) });

const network = (id: number) =>
  new NeteaseNetworkAudio({
    id,
    url: `https://audio.test/${id}.mp3`,
    quality: TrackQuality.h,
    meta: {} as ConstructorParameters<typeof NeteaseNetworkAudio>[0]["meta"]
  });

const local = (id: number) => NeteaseLocalAudio.fromNetwork(network(id), `cache://${id}`);

const pendingBlob = () => {
  const body = Promise.withResolvers<Blob>();
  const started = Promise.withResolvers<void>();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    blob: () => {
      started.resolve();
      return body.promise;
    }
  });
  return { ...body, started: started.promise };
};

const audio = () => {
  const value = new RendererPlayerAudio();
  disposables.push(value);
  return value;
};

const player = () => {
  const value = new RendererPlayer();
  disposables.push(value);
  return value;
};

const loadPlayer = (value: RendererPlayer, next: NeteaseTrackRecord, play = true) =>
  (
    value as unknown as {
      load(track: NeteaseTrackRecord, play: boolean): Promise<"ok" | "error" | "cancel">;
    }
  ).load(next, play);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  fetchMock.mockReset();
  mocks.track.mockReset();
  mocks.idleTasks.length = 0;
  vi.stubGlobal("Audio", TestAudio);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL = createObjectURL;
    }
  );
});

afterEach(() => {
  for (const value of disposables.splice(0)) value[Symbol.dispose]();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("音频源异步提交", () => {
  it("源提交时同时更新进度的歌曲身份和跳转时间，等待缓存期间保留旧源进度", async () => {
    const value = audio();
    await value.load(track(1), network(1), false, 90);
    expect(value.progress).toMatchObject({ trackID: 1, currentTime: 90 });

    const blob = pendingBlob();
    const pending = value.load(track(2), local(2), false, 7);
    await blob.started;
    expect(value.progress).toMatchObject({ trackID: 1, currentTime: 90 });

    blob.resolve(new Blob(["new source"]));
    expect(await pending).toBe(true);
    expect(value.instance.src).toBe("blob:cached-audio");
    expect(value.currentTime).toBe(7);
    expect(value.progress).toMatchObject({ trackID: 2, currentTime: 7 });
  });

  it.each([1, 2])("旧缓存读取不能覆盖后续加载，后续歌曲=%s", async (nextID) => {
    const value = audio();
    const blob = pendingBlob();
    const pending = value.load(track(1), local(1), false, 30);
    await blob.started;
    expect(await value.load(track(nextID), network(nextID), true, 7)).toBe(true);
    blob.resolve(new Blob(["old cache"]));
    expect(await pending).toBe(false);
    expect(value.instance.src).toBe(network(nextID).url);
    expect(value.currentTime).toBe(7);
    expect(value.progress).toMatchObject({ trackID: nextID, currentTime: 7 });
    expect(value.paused).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("取消发生在 blob 读取期间时不提交 src 或进度", async () => {
    const value = audio();
    await value.load(track(2), network(2), false, 9);
    const controller = new AbortController();
    const blob = pendingBlob();
    const pending = value.load(track(1), local(1), false, 30, controller.signal);
    await blob.started;
    controller.abort();
    blob.resolve(new Blob(["cancelled"]));
    expect(await pending).toBe(false);
    expect(value.instance.src).toBe(network(2).url);
    expect(value.currentTime).toBe(9);
    expect(value.progress).toMatchObject({ trackID: 2, currentTime: 9 });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("销毁后到达的缓存结果不能恢复音频元素", async () => {
    const value = audio();
    const blob = pendingBlob();
    const pending = value.load(track(1), local(1), true, 30);
    await blob.started;
    value[Symbol.dispose]();
    disposables.splice(disposables.indexOf(value), 1);
    blob.resolve(new Blob(["disposed"]));
    expect(await pending).toBe(false);
    expect(value.instance.src).toBe("");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect((value.instance as unknown as TestAudio).play).not.toHaveBeenCalled();
  });

  it.each(["play", "pause"] as const)("等待缓存期间的 %s 保留到源提交", async (intent) => {
    const value = audio();
    const blob = pendingBlob();
    const pending = value.load(track(1), local(1), intent === "pause", 11);
    await blob.started;
    value[intent]();
    expect((value.instance as unknown as TestAudio).play).not.toHaveBeenCalled();
    blob.resolve(new Blob(["cache"]));
    expect(await pending).toBe(true);
    expect(value.currentTime).toBe(11);
    expect(value.paused).toBe(intent === "pause");
  });

  it("旧错误的缓存查询晚返回时不替换新音频源", async () => {
    const value = audio();
    await value.load(track(1), network(1), true, 10);
    const lookup = Promise.withResolvers<NeteaseLocalAudio>();
    mocks.track.mockReturnValueOnce(lookup.promise);
    value.instance.dispatchEvent(new Event("error"));
    await value.load(track(2), network(2), true, 21);
    lookup.resolve(local(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(value.instance.src).toBe(network(2).url);
    expect(value.currentTime).toBe(21);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("播放器缓存与恢复任务", () => {
  it.each([1, 2])("暂停替换已进入 blob 读取后，新 session 的歌曲 %s 保持进度", async (nextID) => {
    const value = player();
    mocks.track.mockResolvedValueOnce(network(1));
    expect(await loadPlayer(value, record(1))).toBe("ok");
    const previousSession = value.session.sessionId;
    await vi.advanceTimersByTimeAsync(40_000);
    const task = mocks.idleTasks.shift()!;
    mocks.track.mockResolvedValueOnce(local(1));
    await task.next();
    await task.next();

    const blob = pendingBlob();
    const load = vi.spyOn(value.audio, "load");
    value.audio.pause();
    await blob.started;
    const replacing = load.mock.results[0]!.value;
    mocks.track.mockResolvedValueOnce(network(nextID));
    expect(await loadPlayer(value, record(nextID))).toBe("ok");
    value.audio.currentTime = 47;
    blob.resolve(new Blob(["previous session"]));
    await replacing;

    expect(value.session.sessionId).not.toBe(previousSession);
    expect(value.current.track?.id).toBe(nextID);
    expect(value.current.audio?.url).toBe(network(nextID).url);
    expect(value.audio.instance.src).toBe(network(nextID).url);
    expect(value.audio.currentTime).toBe(47);
    expect(value.audio.paused).toBe(false);
  });

  it("恢复的旧 URL 重新加载不能在切歌后提交缓存或持久化进度", async () => {
    const previous = player();
    mocks.track.mockResolvedValueOnce(network(1));
    await loadPlayer(previous, record(1), false);
    previous.audio.currentTime = 36;
    const restored = RendererPlayer.fromSave(RendererPlayer.save(previous));
    disposables.push(restored);
    const restoreTask = mocks.idleTasks.shift()!;
    fetchMock.mockResolvedValueOnce({ ok: false });
    await restoreTask.next();
    mocks.track.mockResolvedValueOnce(local(1));
    await restoreTask.next();

    const blob = pendingBlob();
    const completing = restoreTask.next();
    await blob.started;
    mocks.track.mockResolvedValueOnce(network(2));
    await loadPlayer(restored, record(2));
    restored.audio.currentTime = 58;
    blob.resolve(new Blob(["old restored cache"]));
    await completing;

    expect(restored.current.track?.id).toBe(2);
    expect(restored.current.audio?.url).toBe(network(2).url);
    expect(restored.audio.instance.src).toBe(network(2).url);
    expect(restored.audio.currentTime).toBe(58);
    expect(restored.audio.paused).toBe(false);
  });
});
