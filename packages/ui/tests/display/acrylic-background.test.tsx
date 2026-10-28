import { act, render, cleanup } from "@testing-library/react";
import AcrylicBackground from "@mahiru/ui/common/components/display/acrylic-background";

const visibility = vi.hoisted(() => ({ visible: true }));
const resize = vi.hoisted(() => ({
  count: 0,
  width: 1080,
  height: 650,
  listener: null as null | (() => void)
}));
vi.mock("@/common/hooks/use-window-visible", () => ({
  useWindowVisible: () => visibility.visible
}));
vi.mock("@/common/hooks/use-listen-resize", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useListenResize: () =>
      useSyncExternalStore(
        (listener) => {
          resize.listener = listener;
          return () => {
            resize.listener = null;
          };
        },
        () => resize.count
      )
  };
});

const context = {
  filter: "none",
  arc: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn()
};
let images: { reject: () => void; resolve: () => void; image: HTMLImageElement }[];
let frames: Map<number, FrameRequestCallback>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  visibility.visible = true;
  resize.count = 0;
  resize.width = 1080;
  resize.height = 650;
  images = [];
  frames = new Map();
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as any);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => resize.width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => resize.height);
  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        const image = document.createElement("img");
        Object.defineProperties(image, {
          naturalWidth: { value: 300 },
          naturalHeight: { value: 300 }
        });
        image.decode = () =>
          new Promise<void>((resolve, reject) => {
            images.push({ image, resolve, reject: () => reject(new Error("load failed")) });
          });
        return image;
      }
    }
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps bounded, preblurred textures when pausing, hiding, or changing animation speed", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const onLoaded = vi.fn();
  const view = (fluidPaused = false, fluidSpeed = 1) => (
    <AcrylicBackground
      blur={60}
      fluidSpeed={fluidSpeed}
      fluidPaused={fluidPaused}
      src="https://covers.test/one.png"
      onLoaded={onLoaded}
      fluid
    />
  );
  const { rerender, container } = render(view());
  await act(async () => images[0]!.resolve());

  expect(onLoaded).toHaveBeenCalledTimes(1);
  expect(container.querySelectorAll("canvas")).toHaveLength(4);
  for (const canvas of container.querySelectorAll("canvas")) {
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(512);
  }
  expect(container.querySelector("[style*='filter']")).toBeNull();
  const driftLayers = () => [...container.querySelectorAll<HTMLElement>("[style*='animation']")];
  const drawCount = context.drawImage.mock.calls.length;

  rerender(view(true));
  expect(driftLayers().every((layer) => layer.style.animationPlayState === "paused")).toBe(true);
  rerender(view(true, 3));
  expect(driftLayers()).toHaveLength(3);
  expect(driftLayers().every((layer) => layer.style.animationPlayState === "paused")).toBe(true);
  expect(consoleError).not.toHaveBeenCalled();
  expect(driftLayers()[0]!.style.animationDuration).toBe("14s");
  rerender(view(false, 5));
  expect(driftLayers().every((layer) => layer.style.animationPlayState === "running")).toBe(true);
  visibility.visible = false;
  rerender(view(false, 7));
  expect(driftLayers().every((layer) => layer.style.animationPlayState === "paused")).toBe(true);
  expect(context.drawImage).toHaveBeenCalledTimes(drawCount);
  expect(images).toHaveLength(1);
  expect(consoleError).not.toHaveBeenCalled();
});

it("crossfades prepared covers and keeps the incoming canvases when committing the transition", async () => {
  const { rerender, container } = render(
    <AcrylicBackground src="https://covers.test/one.png" fluid fluidPaused />
  );
  await act(async () => images[0]!.resolve());
  const oldCanvases = [...container.querySelectorAll("canvas")];
  rerender(<AcrylicBackground src="https://covers.test/two.png" fluid fluidPaused />);
  expect([...container.querySelectorAll("canvas")]).toEqual(oldCanvases);
  await act(async () => images[1]!.resolve());
  expect(container.querySelectorAll("canvas")).toHaveLength(8);
  const incomingCanvases = [...container.querySelectorAll("canvas")].slice(4);
  runFrame();
  runFrame();
  const drawCount = context.drawImage.mock.calls.length;
  act(() => vi.advanceTimersByTime(800));

  expect([...container.querySelectorAll("canvas")]).toEqual(incomingCanvases);
  expect(context.drawImage).toHaveBeenCalledTimes(drawCount);
  expect(frames.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("ignores stale image decodes and cancels transitions when switching back or clearing the source", async () => {
  const onLoaded = vi.fn();
  const view = (src?: string) => <AcrylicBackground src={src} onLoaded={onLoaded} fluid />;
  const { unmount, rerender, container } = render(view("https://covers.test/one.png"));
  await act(async () => images[0]!.resolve());
  const originalCanvases = [...container.querySelectorAll("canvas")];
  rerender(view("https://covers.test/two.png"));
  rerender(view("https://covers.test/three.png"));
  await act(async () => images[1]!.resolve());
  expect(onLoaded).toHaveBeenCalledTimes(1);
  await act(async () => images[2]!.resolve());
  runFrame();
  runFrame();
  rerender(view("https://covers.test/one.png"));
  act(() => vi.advanceTimersByTime(1000));
  expect([...container.querySelectorAll("canvas")]).toEqual(originalCanvases);
  expect(frames.size).toBe(0);

  rerender(view("https://covers.test/four.png"));
  await act(async () => images[3]!.resolve());
  expect(frames.size).toBe(1);
  rerender(view(undefined));
  expect(container.querySelectorAll("canvas")).toHaveLength(0);
  expect(frames.size).toBe(0);

  rerender(view("https://covers.test/five.png"));
  unmount();
  await act(async () => images[4]!.resolve());
  expect(onLoaded).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves the previous cover when the replacement cannot be decoded", async () => {
  const { rerender, container } = render(<AcrylicBackground src="https://covers.test/one.png" />);
  await act(async () => images[0]!.resolve());
  const canvas = container.querySelector("canvas");
  rerender(<AcrylicBackground src="https://covers.test/broken.png" />);
  await act(async () => images[1]!.reject());
  expect(container.querySelector("canvas")).toBe(canvas);
  expect(frames.size).toBe(0);
});

it("rebuilds bounded textures after resizing but skips notifications with unchanged dimensions", async () => {
  const { container } = render(
    <AcrylicBackground blur={60} src="https://covers.test/one.png" fluid />
  );
  await act(async () => images[0]!.resolve());
  const drawCount = context.drawImage.mock.calls.length;
  resize.width = 3840;
  resize.height = 2160;
  act(() => {
    resize.count++;
    resize.listener?.();
  });
  expect(context.drawImage).toHaveBeenCalledTimes(drawCount + 8);
  for (const canvas of container.querySelectorAll("canvas")) {
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(512);
  }
  act(() => {
    resize.count++;
    resize.listener?.();
  });
  expect(context.drawImage).toHaveBeenCalledTimes(drawCount + 8);
  expect(images).toHaveLength(1);
});

function runFrame() {
  const [id, callback] = frames.entries().next().value!;
  frames.delete(id);
  act(() => callback(0));
}
