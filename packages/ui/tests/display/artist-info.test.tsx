import { act, render, cleanup, fireEvent } from "@testing-library/react";
import Info from "@mahiru/ui/common/components/page/artist/header/info";
import type { NeteaseArtist } from "@mahiru/ui/common/netease/models";

vi.mock("@/common/hooks/use-window-visible", () => ({
  useWindowVisible: () => true
}));

vi.mock("@/common/components/display/toast", () => ({
  default: { show: vi.fn() }
}));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }
}

let observers: ResizeObserverMock[];
let frames: Map<number, FrameRequestCallback>;
let frameId: number;

beforeEach(() => {
  observers = [];
  frames = new Map();
  frameId = 0;
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const artist = {
  id: 1,
  hotTracks: [],
  followInfos: { follow: false, fansCnt: 100, followDay: "" },
  detail: {
    artist: {
      name: "テスト歌手",
      alias: ["Alias A", "Alias B"],
      transNames: ["Trans Name"],
      briefDesc: "这是一段很长的歌手简介",
      avatar: "",
      albumSize: 0
    }
  }
} as unknown as NeteaseArtist;

function layout(container: HTMLElement, scrollHeight: number, offsetHeight = 48) {
  const desc = container.querySelector("p")!;
  Object.defineProperty(desc, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(desc, "offsetHeight", { configurable: true, value: offsetHeight });
  // 别名跑马灯也会注册 ResizeObserver，这里只取观察简介的那个
  const observer = observers.find((item) =>
    item.observe.mock.calls.some(([target]) => target === desc)
  )!;
  act(() => {
    observer.callback([], observer as unknown as ResizeObserver);
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  });
  return desc;
}

it("folds the brief description to three lines and toggles it on demand", () => {
  const { container, queryByRole } = render(<Info artist={artist} />);
  const desc = layout(container, 120);

  const toggle = queryByRole("button", { name: "展开" })!;
  expect(toggle).toBeInTheDocument();
  expect(desc).toHaveClass("line-clamp-3");

  fireEvent.click(toggle);
  expect(desc).toHaveClass("line-clamp-none");
  expect(queryByRole("button", { name: "收起" })).toBeInTheDocument();

  fireEvent.click(queryByRole("button", { name: "收起" })!);
  expect(desc).toHaveClass("line-clamp-3");
});

it("does not offer the toggle when the description already fits", () => {
  const { container, queryByRole } = render(<Info artist={artist} />);
  layout(container, 40, 40);

  expect(queryByRole("button", { name: "展开" })).not.toBeInTheDocument();
});

it("keeps very long descriptions scrollable instead of pushing the page", () => {
  const { container, queryByRole } = render(<Info artist={artist} />);
  const desc = layout(container, 2000);

  fireEvent.click(queryByRole("button", { name: "展开" })!);
  expect(desc).toHaveClass("max-h-20");
  expect(desc.parentElement).toHaveClass("overflow-y-auto");
});

it("renders the alias as a marquee instead of a truncated line", () => {
  const { container } = render(<Info artist={artist} />);
  const translation = container.querySelector("h2[title]")!;

  expect(translation).toHaveTextContent("Trans Name");
  expect(translation).toHaveAttribute("title", "Trans Name");
  expect(translation.firstElementChild).toHaveClass("inline-block");
  expect(container).toHaveTextContent("别名: Alias A / Alias B");
});

it("measures overflow after an initially hidden artist page becomes visible", () => {
  const { container, queryByRole } = render(<Info artist={artist} />);
  layout(container, 0, 0);
  expect(queryByRole("button", { name: "展开" })).not.toBeInTheDocument();

  layout(container, 120);
  expect(queryByRole("button", { name: "展开" })).toBeInTheDocument();
});

it("updates the expand control when resizing makes the description fit or overflow", () => {
  const { container, queryByRole } = render(<Info artist={artist} />);
  layout(container, 120);
  expect(queryByRole("button", { name: "展开" })).toBeInTheDocument();

  layout(container, 48);
  expect(queryByRole("button", { name: "展开" })).not.toBeInTheDocument();

  layout(container, 160);
  expect(queryByRole("button", { name: "展开" })).toBeInTheDocument();
});

it("preserves expanded content through resize and hidden-to-visible transitions", () => {
  const { container, getByRole } = render(<Info artist={artist} />);
  const desc = layout(container, 120);
  fireEvent.click(getByRole("button", { name: "展开" }));

  layout(container, 200, 80);
  expect(desc).toHaveClass("line-clamp-none");
  expect(getByRole("button", { name: "收起" })).toBeInTheDocument();

  layout(container, 0, 0);
  layout(container, 40, 40);
  expect(desc).toHaveClass("line-clamp-none");
  fireEvent.click(getByRole("button", { name: "收起" }));
  expect(desc).toHaveClass("line-clamp-3");
});

it("resets expansion when refreshed artist data changes the description", () => {
  const { rerender, container, getByRole, queryByRole } = render(<Info artist={artist} />);
  const desc = layout(container, 120);
  fireEvent.click(getByRole("button", { name: "展开" }));
  const next = {
    ...artist,
    detail: { ...artist.detail, artist: { ...artist.detail.artist, briefDesc: "新的简介" } }
  } as NeteaseArtist;
  rerender(<Info artist={next} />);

  expect(desc).toHaveTextContent("新的简介");
  expect(desc).toHaveClass("line-clamp-3");
  expect(queryByRole("button", { name: "收起" })).not.toBeInTheDocument();
});
