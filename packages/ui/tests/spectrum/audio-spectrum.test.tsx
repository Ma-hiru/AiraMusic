import { Provider, createStore } from "jotai";
import { act, render, cleanup } from "@testing-library/react";
import { spectrumDataAtom, spectrumReadyAtom } from "@mahiru/ui/wins/main/atoms/spectrum";
import AudioSpectrum from "@mahiru/ui/wins/main/componets/spectrum/audio-spectrum";

const renderer = vi.hoisted(() => ({
  size: 0,
  init: vi.fn(),
  draw: vi.fn(),
  destroy: vi.fn()
}));
vi.mock("@/common/hooks/use-listen-resize", () => ({ useListenResize: () => renderer.size }));
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
  "stops drawing and clears %s when disabled, then resumes when enabled",
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

    rerender(view(false));
    expect(frames.size).toBe(0);
    expect(renderer.draw).toHaveBeenLastCalledWith(new Float32Array(0));
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

function runFrame(timestamp: number) {
  const next = frames.entries().next().value;
  expect(next).toBeDefined();
  const [id, callback] = next!;
  frames.delete(id);
  act(() => callback(timestamp));
}
