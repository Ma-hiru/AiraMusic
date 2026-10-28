import { type NeteaseTrack, NeteaseTrackRecord } from "@mahiru/ui/common/netease/models";
import RendererPlayerPlaylist from "@mahiru/ui/common/player/playlist";
import RendererPlayer, { RendererPlayerStatus } from "@mahiru/ui/common/player/core";
import type RendererPlayerAudio from "@mahiru/ui/common/player/audio";
import type RendererPlayerHistory from "@mahiru/ui/common/player/history";

vi.mock("@/common/lib/cache", () => ({ RendererCache: {} }));
vi.mock("@/common/store/user", () => ({ userStoreSnapshot: () => ({ _user: null }) }));
vi.mock("@/common/store/settings", () => ({ settingsStoreSnapshot: () => ({ _settings: {} }) }));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/netease/services/auth", () => ({ Status: {} }));
vi.mock("@/common/netease/services", () => ({
  NeteaseServicesAuth: {},
  NeteaseServicesAudio: {},
  NeteaseServicesImage: {},
  NeteaseServicesLyric: {}
}));
vi.mock("@/common/player/audio", () => ({ default: class {} }));
vi.mock("@/common/player/history", () => ({ default: class {} }));

class TestAudio extends EventTarget {
  currentTime = 180;
  progress = { duration: 180 };
  play = vi.fn();
  pause = vi.fn();
  [Symbol.dispose] = vi.fn();
  emit(type: string) {
    this.dispatchEvent(new Event(type));
  }
}

const record = (id: number, playable = true) =>
  new NeteaseTrackRecord({
    sourceID: 42,
    sourceName: "playlist",
    detail: {
      id,
      name: `Track ${id}`,
      playable: () => ({ playable, reason: playable ? "" : "不可播" })
    } as unknown as NeteaseTrack
  });

const createPlayer = (
  tracks: NeteaseTrackRecord[],
  repeat: "all" | "off" | "one" = "all",
  position = 0
) => {
  const audio = new TestAudio();
  const history = { add: vi.fn(), [Symbol.dispose]: vi.fn() };
  const playlist = new RendererPlayerPlaylist({ playlist: tracks, repeat, position });
  const player = new RendererPlayer({
    audio: audio as unknown as RendererPlayerAudio,
    history: history as unknown as RendererPlayerHistory,
    playlist,
    status: RendererPlayerStatus.playing,
    current: { track: tracks[position]!, lyric: null, audio: null, cover: null }
  });
  return { player, playlist, audio, history };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("自然结束时的列表循环", () => {
  it.each([false, true])("只有一首歌时重播已有音频，shuffle=%s", async (shuffle) => {
    const { audio, player, history, playlist } = createPlayer([record(1)]);
    playlist.shuffle = shuffle;
    const changed = vi.fn();
    playlist.addEventListener("currentChange", changed);
    audio.emit("ended");
    await vi.advanceTimersByTimeAsync(100);
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.pause).not.toHaveBeenCalled();
    expect(playlist.current()?.id).toBe(1);
    expect(changed).not.toHaveBeenCalled();
    expect(history.add).not.toHaveBeenCalled();
    player[Symbol.dispose]();
  });

  it("跳过其他不可播歌曲并环绕回当前曲目时也重播", () => {
    const { audio, player, playlist } = createPlayer([
      record(1),
      record(2, false),
      record(3, false)
    ]);
    audio.emit("ended");
    expect(playlist.current()?.id).toBe(1);
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledOnce();
    player[Symbol.dispose]();
  });

  it("每次重播分别结算已播放时长，不把多轮时长累加", async () => {
    let clock = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const { audio, player, history } = createPlayer([record(1)]);
    for (let i = 0; i < 2; i++) {
      audio.emit("playing");
      clock += 7_000;
      audio.emit("timeupdate");
      audio.emit("ended");
      await Promise.resolve();
      clock += 1_000;
    }
    expect(history.add).toHaveBeenCalledTimes(2);
    expect(history.add.mock.calls.map(([entry]) => entry.playDuration)).toEqual([7, 7]);
    expect(audio.play).toHaveBeenCalledTimes(2);
    player[Symbol.dispose]();
  });

  it("有下一首可播曲目时仍走正常切歌，不重播旧音频", async () => {
    const tracks = [record(1), record(2)];
    const { audio, player, playlist } = createPlayer(tracks);
    const load = vi
      .spyOn(player as unknown as { load: (...args: unknown[]) => Promise<string> }, "load")
      .mockResolvedValue("ok");
    audio.emit("ended");
    expect(audio.currentTime).toBe(180);
    expect(audio.play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(playlist.current()).toBe(tracks[1]);
    expect(load).toHaveBeenCalledExactlyOnceWith(tracks[1], true);
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.play).toHaveBeenCalledOnce();
    player[Symbol.dispose]();
  });

  it("当前曲目也不可播时停止，不形成重播循环", async () => {
    const { audio, player, playlist } = createPlayer([record(1, false)]);
    audio.emit("ended");
    await vi.advanceTimersByTimeAsync(100);
    expect(playlist.current()).toBeNull();
    expect(audio.play).not.toHaveBeenCalled();
    expect(player.status).toBe(RendererPlayerStatus.idle);
    player[Symbol.dispose]();
  });

  it("repeat=off 到末尾停止，repeat=one 继续重播", async () => {
    for (const repeat of ["off", "one"] as const) {
      const { audio, player, playlist } = createPlayer([record(1)], repeat);
      audio.emit("ended");
      await vi.advanceTimersByTimeAsync(100);
      expect(audio.play).toHaveBeenCalledTimes(repeat === "one" ? 1 : 0);
      expect(playlist.current()?.id ?? null).toBe(repeat === "one" ? 1 : null);
      player[Symbol.dispose]();
    }
  });

  it("手动 next/previous 环绕同一曲目与队列修改不会触发重播", async () => {
    const { audio, player, playlist } = createPlayer([record(1)]);
    playlist.next();
    playlist.last();
    playlist.add(record(2), "end");
    await vi.advanceTimersByTimeAsync(100);
    expect(playlist.current()?.id).toBe(1);
    expect(audio.currentTime).toBe(180);
    expect(audio.play).not.toHaveBeenCalled();
    player[Symbol.dispose]();
  });
});
