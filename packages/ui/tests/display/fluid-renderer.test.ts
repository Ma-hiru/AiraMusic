import { FluidRenderer } from "@mahiru/ui/common/lib/fluid-renderer";

const wasm = vi.hoisted(() => ({
  render: vi.fn(),
  setImage: vi.fn(),
  setPaused: vi.fn(),
  setSpeed: vi.fn(),
  setOpacity: vi.fn(),
  destroy: vi.fn(),
  free: vi.fn()
}));

vi.mock("@mahiru/wasm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mahiru/wasm")>()),
  FluidRenderer: class {
    render = wasm.render;
    setImage = wasm.setImage;
    setPaused = wasm.setPaused;
    setSpeed = wasm.setSpeed;
    setOpacity = wasm.setOpacity;
    destroy = wasm.destroy;
    free = wasm.free;
  }
}));

let frames: Map<number, FrameRequestCallback>;

beforeEach(() => {
  vi.resetAllMocks();
  wasm.render.mockReturnValue(true);
  frames = new Map();
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => vi.unstubAllGlobals());

function create() {
  const canvas = document.createElement("canvas");
  Object.defineProperties(canvas, {
    clientWidth: { value: 1000 },
    clientHeight: { value: 600 }
  });
  const onContextLost = vi.fn();
  const renderer = new FluidRenderer(canvas, {
    blur: 60,
    saturate: 3,
    brightness: 0.4,
    speed: 1,
    maxPixelRatio: 1,
    onContextLost
  });
  return { renderer, canvas, onContextLost };
}

function frame(now: number) {
  const [id, callback] = frames.entries().next().value!;
  frames.delete(id);
  callback(now);
}

it("passes browser frames and settings to wasm and releases resources exactly once", () => {
  const { renderer } = create();
  const image = document.createElement("img");
  renderer.setImage(image);
  renderer.setPaused(true);
  renderer.setSpeed(3);
  renderer.setOpacity(0.4);
  frame(100);
  expect(wasm.setImage).toHaveBeenCalledWith(image, expect.any(Number));
  expect(wasm.setPaused).toHaveBeenCalledWith(true);
  expect(wasm.setSpeed).toHaveBeenCalledWith(3);
  expect(wasm.setOpacity).toHaveBeenCalledWith(0.4);
  expect(wasm.render).toHaveBeenCalledWith(100, 1000, 600);
  expect(frames.size).toBe(1);
  renderer.destroy();
  renderer.destroy();
  renderer.setImage(image);
  expect(wasm.setImage).toHaveBeenCalledTimes(1);
  expect(wasm.destroy).toHaveBeenCalledTimes(1);
  expect(wasm.free).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
});

it("stops the loop and requests CSS fallback on context loss", () => {
  const { onContextLost, canvas, renderer } = create();
  const event = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(event);
  canvas.dispatchEvent(new Event("webglcontextlost"));
  expect(event.defaultPrevented).toBe(true);
  expect(onContextLost).toHaveBeenCalledTimes(1);
  expect(wasm.free).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  renderer.destroy();
});

it.each(["setImage", "render"] as const)("falls back after a wasm %s failure", (method) => {
  const { onContextLost, renderer } = create();
  wasm[method].mockImplementationOnce(() => {
    throw new Error("WebGL unavailable");
  });
  if (method === "render") frame(100);
  else renderer.setImage(document.createElement("img"));
  expect(onContextLost).toHaveBeenCalledTimes(1);
  expect(wasm.free).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
  renderer.destroy();
});

it("sleeps after a static frame and wakes only for a changed image, resize, or resume", () => {
  wasm.render.mockReturnValue(false);
  const { renderer } = create();
  const image = document.createElement("img");
  renderer.setPaused(true);
  renderer.setImage(image);
  frame(100);
  expect(frames.size).toBe(0);
  expect(wasm.render).toHaveBeenCalledTimes(1);

  renderer.setSpeed(2);
  expect(frames.size).toBe(0);
  window.dispatchEvent(new Event("resize"));
  expect(frames.size).toBe(1);
  frame(200);
  expect(frames.size).toBe(0);
  expect(wasm.setImage).toHaveBeenCalledTimes(1);

  renderer.setImage(document.createElement("img"));
  wasm.render.mockReturnValueOnce(true);
  frame(300);
  expect(frames.size).toBe(1);
  frame(1100);
  expect(frames.size).toBe(0);

  wasm.render.mockReturnValue(true);
  renderer.setPaused(false);
  frame(1200);
  expect(frames.size).toBe(1);
  renderer.destroy();
  window.dispatchEvent(new Event("resize"));
  expect(frames.size).toBe(0);
});
