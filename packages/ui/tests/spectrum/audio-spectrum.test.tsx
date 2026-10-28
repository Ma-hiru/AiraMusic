import { Provider, createStore } from "jotai";
import { act, render, cleanup } from "@testing-library/react";
import { spectrumDataAtom, spectrumReadyAtom } from "@mahiru/ui/wins/main/atoms/spectrum";
import AudioSpectrum from "@mahiru/ui/wins/main/componets/spectrum/audio-spectrum";

const renderer = vi.hoisted(() => ({
  size: 0,
  frame: [] as number[],
  onResize: null as null | (() => void),
  init: vi.fn(),
  draw: vi.fn(),
  destroy: vi.fn()
}));
vi.mock("@/common/hooks/use-listen-resize", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useListenResize: () =>
      useSyncExternalStore(
        (listener) => {
          renderer.onResize = listener;
          return () => {
            renderer.onResize = null;
          };
        },
        () => renderer.size
      )
  };
});
vi.mock("@/wins/main/componets/spectrum/renderers/canvas2d", () => ({
  Canvas2DRenderer: class {
    init = renderer.init;
    draw = renderer.draw;
    destroy = renderer.destroy;
  }
}));
vi.mock("@/wins/main/componets/spectrum/renderers/webgl-rust", () => ({
  WebGLRendererRust: class {
    init = renderer.init;
    draw = renderer.draw;
    destroy = renderer.destroy;
  }
}));

let frames: Map<number, FrameRequestCallback>;

beforeEach(() => {
  vi.clearAllMocks();
  renderer.size = 0;
  renderer.frame = [];
  renderer.init.mockImplementation(() => {
    renderer.frame = [];
  });
  renderer.draw.mockImplementation((bands: Float32Array) => {
    renderer.frame = Array.from(bands);
  });
  frames = new Map();
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each(["canvas", "webgl-rust"] as const)(
  "stops drawing and keeps the last frame for %s when disabled, then resumes when enabled",
  (type) => {
    const store = createStore();
    store.set(spectrumReadyAtom, true);
    store.set(spectrumDataAtom, { bands: new Float32Array([0.5, 0.8]) });
    const view = (enable: boolean) => (
      <Provider store={store}>
        <AudioSpectrum enable={enable} renderer={type} />
      </Provider>
    );
    const { unmount, rerender } = render(view(false));
    expect(frames.size).toBe(0);

    renderer.size = 1;
    rerender(view(true));
    expect(renderer.init).toHaveBeenCalledTimes(1);
    runFrame(0);
    expect(renderer.draw.mock.calls.at(-1)?.[0]).toHaveLength(2);
    expect(frames.size).toBe(1);

    const drawCount = renderer.draw.mock.calls.length;
    rerender(view(false));
    expect(frames.size).toBe(0);
    expect(renderer.draw).toHaveBeenCalledTimes(drawCount);
    expect(renderer.destroy).not.toHaveBeenCalled();

    rerender(view(true));
    runFrame(1000);
    expect(renderer.draw.mock.calls.at(-1)?.[0]).toHaveLength(2);
    expect(frames.size).toBe(1);

    unmount();
    expect(frames.size).toBe(0);
    expect(renderer.destroy).toHaveBeenCalledTimes(1);
  }
);

it.each([
  ["canvas", "resize"],
  ["canvas", "color"],
  ["webgl-rust", "resize"],
  ["webgl-rust", "color"]
] as const)(
  "redraws the last displayed frame once for %s after %s while paused",
  (type, change) => {
    const store = createStore();
    store.set(spectrumReadyAtom, true);
    store.set(spectrumDataAtom, { bands: new Float32Array([0.5, 0.8]) });
    const view = (enable: boolean, color = "#ffffff") => (
      <Provider store={store}>
        <AudioSpectrum color={color} enable={enable} renderer={type} />
      </Provider>
    );
    const { rerender } = render(view(true));
    act(() => {
      renderer.size++;
      renderer.onResize?.();
    });
    runFrame(0);
    const lastFrame = [...renderer.frame];
    const drawCount = renderer.draw.mock.calls.length;
    rerender(view(false));

    act(() => {
      store.set(spectrumDataAtom, { bands: new Float32Array([0.1, 0.2, 0.3]) });
    });
    expect(renderer.draw).toHaveBeenCalledTimes(drawCount);

    if (change === "resize") {
      act(() => {
        renderer.size++;
        renderer.onResize?.();
      });
    } else {
      rerender(view(false, "#ff0000"));
    }

    expect(renderer.init).toHaveBeenCalledTimes(2);
    expect(renderer.draw).toHaveBeenCalledTimes(drawCount + 1);
    expect(renderer.frame).toEqual(lastFrame);
    expect(frames.size).toBe(0);

    rerender(view(true, change === "color" ? "#ff0000" : "#ffffff"));
    runFrame(1000);
    expect(renderer.frame).toHaveLength(3);
    expect(frames.size).toBe(1);
  }
);

it.each(["canvas", "webgl-rust"] as const)(
  "limits actual %s draws to the configured FPS across display refresh rates",
  (type) => {
    for (const refreshRate of [60, 90, 120, 144]) {
      for (const fpsLimit of [15, 30, 60]) {
        const store = createStore();
        store.set(spectrumReadyAtom, true);
        store.set(spectrumDataAtom, { bands: new Float32Array([0.5, 0.8]) });
        const { unmount } = render(
          <Provider store={store}>
            <AudioSpectrum renderer={type} spectrumOptions={{ fpsLimit }} enable />
          </Provider>
        );
        act(() => {
          renderer.size++;
          renderer.onResize?.();
        });
        const initialDraws = renderer.draw.mock.calls.length;
        for (let frame = 0; frame < refreshRate; frame++) runFrame((frame * 1000) / refreshRate);

        expect(renderer.draw.mock.calls.length - initialDraws).toBe(fpsLimit);
        unmount();
        expect(frames.size).toBe(0);
      }
    }
  }
);

it("changes FPS immediately without resetting the displayed envelope or renderer", () => {
  const store = createStore();
  store.set(spectrumReadyAtom, true);
  store.set(spectrumDataAtom, { bands: new Float32Array([1]) });
  const view = (fpsLimit: number) => (
    <Provider store={store}>
      <AudioSpectrum renderer="webgl-rust" spectrumOptions={{ fpsLimit }} enable />
    </Provider>
  );
  const { rerender } = render(view(30));
  act(() => {
    renderer.size++;
    renderer.onResize?.();
  });
  runFrame(0);
  runFrame(1000 / 30);
  const lastValue = renderer.frame[0]!;
  const initialDraws = renderer.draw.mock.calls.length;

  rerender(view(15));
  runFrame(50);
  expect(renderer.frame[0]).toBeGreaterThan(lastValue);
  expect(renderer.init).toHaveBeenCalledTimes(1);
  expect(renderer.draw).toHaveBeenCalledTimes(initialDraws + 1);
  runFrame(100);
  expect(renderer.draw).toHaveBeenCalledTimes(initialDraws + 1);
  runFrame(50 + 1000 / 15);
  expect(renderer.draw).toHaveBeenCalledTimes(initialDraws + 2);

  rerender(view(60));
  runFrame(125);
  runFrame(125 + 1000 / 60);
  expect(renderer.draw).toHaveBeenCalledTimes(initialDraws + 4);
  expect(renderer.init).toHaveBeenCalledTimes(1);
});

it("uses elapsed draw time for smoothing and does not catch up with a burst after a stalled frame", () => {
  const store = createStore();
  store.set(spectrumReadyAtom, true);
  store.set(spectrumDataAtom, { bands: new Float32Array([1]) });
  render(
    <Provider store={store}>
      <AudioSpectrum spectrumOptions={{ fpsLimit: 15 }} enable />
    </Provider>
  );
  act(() => {
    renderer.size++;
    renderer.onResize?.();
  });
  runFrame(0);
  expect(renderer.frame[0]).toBeCloseTo(1 - Math.exp(-(1000 / 15) / 32));
  runFrame(1000 / 60);
  expect(renderer.draw).toHaveBeenCalledTimes(1);
  runFrame(1000 / 15);
  expect(renderer.frame[0]).toBeCloseTo(1 - Math.exp(-(2000 / 15) / 32));
  runFrame(2000);
  runFrame(2000 + 1000 / 60);
  expect(renderer.draw).toHaveBeenCalledTimes(3);
});

function runFrame(timestamp: number) {
  const next = frames.entries().next().value;
  expect(next).toBeDefined();
  const [id, callback] = next!;
  frames.delete(id);
  act(() => callback(timestamp));
}
