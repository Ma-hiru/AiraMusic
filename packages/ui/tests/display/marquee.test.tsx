import { act, render, cleanup, fireEvent } from "@testing-library/react";
import Marquee from "@mahiru/ui/common/components/display/marquee";

vi.mock("@/common/hooks/use-window-visible", () => ({
  useWindowVisible: () => true
}));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }
}

let observers: ResizeObserverMock[];
let animation: {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
};
let animate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  observers = [];
  animation = { pause: vi.fn(), play: vi.fn(), cancel: vi.fn() };
  animate = vi.fn(() => animation);
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function resize(container: HTMLElement) {
  const inner = container.firstElementChild!;
  Object.defineProperty(container, "clientWidth", { configurable: true, value: 100 });
  Object.defineProperty(inner, "scrollWidth", { configurable: true, value: 300 });
  Object.defineProperty(inner, "animate", { configurable: true, value: animate });
  const observer = observers.at(-1)!;
  act(() => observer.callback([], observer as unknown as ResizeObserver));
}

it.each(["text", "children"] as const)(
  "starts scrolling when initially empty %s appears and restarts after it disappears",
  (content) => {
    const text = "TV 动画《示例》片尾曲";
    const view = (filled: boolean) =>
      content === "text" ? (
        <Marquee text={filled ? text : undefined} />
      ) : (
        <Marquee>{filled ? text : null}</Marquee>
      );
    const { rerender, container } = render(view(false));
    expect(container).toBeEmptyDOMElement();
    expect(observers).toHaveLength(0);

    rerender(view(true));
    expect(observers).toHaveLength(1);
    const observer = observers[0]!;
    const title = container.querySelector("h1")!;
    expect(observer.observe).toHaveBeenCalledWith(title);
    expect(observer.observe).toHaveBeenCalledWith(title.firstElementChild);
    resize(title);
    expect(animate).toHaveBeenCalledTimes(1);

    fireEvent.mouseEnter(title);
    expect(animation.pause).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(title);
    expect(animation.play).toHaveBeenCalled();

    rerender(view(false));
    expect(container).toBeEmptyDOMElement();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(animation.cancel).toHaveBeenCalledTimes(1);

    rerender(view(true));
    expect(observers).toHaveLength(2);
    resize(container.querySelector("h1")!);
    expect(animate).toHaveBeenCalledTimes(2);
  }
);

it("keeps explicitly disabled content stopped until it is enabled", () => {
  const { rerender, container } = render(<Marquee options={{ disable: true }} />);
  rerender(<Marquee text="TV 动画《示例》片尾曲" options={{ disable: true }} />);
  expect(observers).toHaveLength(0);
  expect(animate).not.toHaveBeenCalled();

  rerender(<Marquee text="TV 动画《示例》片尾曲" options={{ disable: false }} />);
  expect(observers).toHaveLength(1);
  resize(container.querySelector("h1")!);
  expect(animate).toHaveBeenCalledTimes(1);
});
