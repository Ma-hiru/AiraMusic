import { createRef, StrictMode } from "react";
import { act, render, cleanup, fireEvent } from "@testing-library/react";
import { usePlayProgress } from "@mahiru/ui/wins/main/hooks/use-play-progress";
import {
  defaultSettings,
  NeteaseSettings
} from "@mahiru/ui/common/netease/models/netease-settings";
import Preference from "@mahiru/ui/common/components/page/settings/content/preference";
import WavePlayerProgress from "@mahiru/ui/common/components/display/player-progress/wave";
import type { PlayerProgressRef } from "@mahiru/ui/common/hooks/use-progress-sync";

const { audio, workers } = vi.hoisted(() => ({
  workers: [] as (EventTarget & {
    terminate: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
  })[],
  audio: Object.assign(new EventTarget(), {
    currentTime: 26,
    progress: { duration: 100, buffered: 63 }
  })
}));

vi.mock("@/worker/wave-progress.ts?worker", () => ({
  default: class extends EventTarget {
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor() {
      super();
      workers.push(this);
    }
  }
}));

vi.mock("@/common/netease/services", () => ({ NeteaseServicesTrack: { chorus: vi.fn() } }));
vi.mock("@/wins/main/hooks/use-player-view-visible", () => ({ usePlayerViewVisible: () => true }));
vi.mock("@/wins/main/lib/handle", () => ({
  default: { usePlayer: () => ({ audio, current: {} }) }
}));

const transfers = new Set<HTMLCanvasElement>();

beforeEach(() => {
  workers.length = 0;
  transfers.clear();
  audio.currentTime = 26;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(48);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
    configurable: true,
    value(this: HTMLCanvasElement) {
      if (transfers.has(this)) throw new Error("canvas already transferred");
      transfers.add(this);
      return {};
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen");
});

it("transfers a fresh canvas on StrictMode setup and keeps the static canvas until ready", () => {
  const ref = createRef<PlayerProgressRef>();
  const view = render(
    <StrictMode>
      <WavePlayerProgress ref={ref} playing />
    </StrictMode>
  );
  expect(transfers.size).toBe(2);
  expect(workers[0]?.terminate).toHaveBeenCalledOnce();
  expect(view.container.querySelectorAll("canvas")).toHaveLength(1);
  expect(view.container.querySelector("svg")).toBeInTheDocument();

  const worker = workers[1]!;
  act(() => ref.current?.tick(true, { percent: 25, buffer: 50 }));
  expect(worker.postMessage).toHaveBeenLastCalledWith({
    type: "progress",
    percent: 25,
    buffer: 50,
    immediate: true
  });
  act(() => worker.dispatchEvent(new MessageEvent("message", { data: { type: "ready", id: 1 } })));
  expect(view.container.querySelector("svg")).not.toBeInTheDocument();

  act(() =>
    worker.dispatchEvent(
      new MessageEvent("message", { data: { type: "error", error: "WASM failed" } })
    )
  );
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(view.container.querySelector("canvas")).not.toBeInTheDocument();
  expect(view.container.querySelector("svg")).toBeInTheDocument();
});

it("releases the canvas during pause and hide while reusing the initialized worker", () => {
  const ref = createRef<PlayerProgressRef>();
  const view = render(<WavePlayerProgress ref={ref} playing={false} />);
  expect(workers).toHaveLength(0);
  expect(view.container.querySelector("svg rect")).toHaveAttribute("x", "0");
  expect(view.container.querySelector("svg rect")).toHaveAttribute("width", "100");

  view.rerender(<WavePlayerProgress ref={ref} playing />);
  const worker = workers[0]!;
  const signal = (type: "idle" | "ready", id: number) => {
    act(() => worker.dispatchEvent(new MessageEvent("message", { data: { type, id } })));
  };
  signal("ready", 1);
  view.rerender(<WavePlayerProgress ref={ref} playing={false} />);
  expect(view.container.querySelector("canvas")).toBeInTheDocument();
  signal("idle", 1);
  expect(view.container.querySelector("canvas")).not.toBeInTheDocument();
  expect(view.container.querySelector("svg")).toBeInTheDocument();

  worker.postMessage.mockClear();
  act(() => ref.current?.tick(true, { percent: 50, buffer: 60 }));
  expect(worker.postMessage).not.toHaveBeenCalled();
  view.rerender(<WavePlayerProgress ref={ref} playing />);
  expect(workers).toHaveLength(1);
  expect(worker.postMessage.mock.calls[0]?.[0]).toMatchObject({
    type: "attach",
    id: 2,
    progress: { percent: 50 }
  });
  signal("ready", 1);
  expect(view.container.querySelector("svg")).toBeInTheDocument();
  signal("ready", 2);
  view.rerender(<WavePlayerProgress ref={ref} visible={false} playing />);
  expect(view.container.querySelector("canvas")).not.toBeInTheDocument();
  expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "detach" });
  act(() => ref.current?.tick(true, { percent: 51, buffer: 60 }));
  expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "detach" });
});

it("previews a padded drag and commits the final position exactly once", () => {
  const ref = createRef<PlayerProgressRef>();
  const onUpdate = vi.fn();
  const view = render(
    <WavePlayerProgress ref={ref} paddingLeft={10} paddingRight={10} onUpdate={onUpdate} playing />
  );
  const slider = view.getByRole("slider");
  vi.spyOn(slider, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 0, 100, 48));
  const worker = workers[0]!;

  fireEvent.pointerDown(slider, { button: 0, pointerId: 1, clientX: 50 });
  expect(slider).toHaveAttribute("aria-valuenow", "25");
  fireEvent.pointerMove(slider, { pointerId: 1, clientX: 70 });
  act(() => ref.current?.tick(false, { percent: 5, buffer: 60 }));
  expect(worker.postMessage).toHaveBeenLastCalledWith({
    type: "progress",
    percent: 50,
    immediate: true
  });
  expect(onUpdate).not.toHaveBeenCalled();

  fireEvent.pointerUp(slider, { pointerId: 1, clientX: 90 });
  fireEvent.click(slider);
  expect(onUpdate).toHaveBeenCalledExactlyOnceWith(75);

  fireEvent.pointerDown(slider, { button: 0, pointerId: 2, clientX: 50 });
  fireEvent.pointerCancel(slider, { pointerId: 2 });
  expect(slider).toHaveAttribute("aria-valuenow", "5");
  expect(onUpdate).toHaveBeenCalledOnce();
});

it("syncs the newly mounted progress bar immediately when switching while paused", () => {
  const BoundProgress = ({ wave }: { wave: boolean }) => {
    const { onUpdate, progressRef } = usePlayProgress("player", wave ? "wave" : "normal");
    return wave ? (
      <WavePlayerProgress ref={progressRef} playing={false} onUpdate={onUpdate} />
    ) : null;
  };
  const view = render(<BoundProgress wave={false} />);
  expect(workers).toHaveLength(0);
  view.rerender(<BoundProgress wave />);
  const slider = view.getByRole("slider");
  expect(slider).toHaveAttribute("aria-valuenow", "26");
  expect(workers).toHaveLength(0);
  expect(slider.querySelectorAll("svg rect")[2]).toHaveAttribute("width", "26");
  audio.currentTime = 48;
  act(() => audio.dispatchEvent(new Event("seeked")));
  expect(slider).toHaveAttribute("aria-valuenow", "48");
  view.rerender(<BoundProgress wave={false} />);
  expect(view.container.querySelector("svg")).not.toBeInTheDocument();
});

it("defaults the two waveform preferences independently and saves each setting on its own", () => {
  const { useWavePlayerProgress, useWaveMiniPlayerProgress, ...oldPreference } =
    defaultSettings.preference;
  const settings = NeteaseSettings.fromObject({
    ...defaultSettings,
    preference: oldPreference as NeteaseSettings["preference"]
  });
  expect(useWavePlayerProgress).toBe(false);
  expect(useWaveMiniPlayerProgress).toBe(true);
  const patchSettings = vi.fn();
  const view = render(<Preference data={settings.preference} patchSettings={patchSettings} />);
  const toggle = (title: string) =>
    view.getByText(title).closest("section")!.querySelector("button")!;
  const playerToggle = toggle("播放页波形进度条");
  const miniToggle = toggle("迷你播放器波形进度条");
  expect(playerToggle).toHaveAttribute("aria-pressed", "false");
  expect(miniToggle).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(playerToggle);
  expect(patchSettings).toHaveBeenNthCalledWith(1, {
    preference: { ...settings.preference, useWavePlayerProgress: true }
  });
  fireEvent.click(miniToggle);
  expect(patchSettings).toHaveBeenNthCalledWith(2, {
    preference: { ...settings.preference, useWaveMiniPlayerProgress: false }
  });
});

it("preserves saved choices for both waveform preferences", () => {
  const settings = NeteaseSettings.fromObject({
    ...defaultSettings,
    preference: {
      ...defaultSettings.preference,
      useWavePlayerProgress: true,
      useWaveMiniPlayerProgress: false
    }
  });
  expect(settings.preference).toMatchObject({
    useWavePlayerProgress: true,
    useWaveMiniPlayerProgress: false
  });
});
