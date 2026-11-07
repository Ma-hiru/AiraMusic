import { StrictMode, type ReactNode } from "react";
import { act, render, cleanup, waitFor, fireEvent } from "@testing-library/react";
import AppModal from "@mahiru/ui/common/components/display/modal/use";
import AppDrawer from "@mahiru/ui/common/components/display/drawer/use";
import AppContextMenu from "@mahiru/ui/common/components/display/menu/use";
import type { DrawerRender } from "@mahiru/ui/common/components/display/drawer/drawer-provider";

vi.mock("@/common/components/display/menu/track-menu", () => ({
  createTrackContextMenu: vi.fn()
}));

function createDrawer(content: ReactNode, options: Partial<DrawerRender> = {}): DrawerRender {
  return { title: "播放列表", content, ...options };
}

function Launcher() {
  const { create } = AppDrawer.useDrawer();
  return <button onClick={() => create(createDrawer, "队列内容")}>打开队列</button>;
}

function Providers() {
  return (
    <>
      <AppDrawer.Provider className="z-32 top-10! bottom-20!" />
      <AppModal.Provider />
      <AppContextMenu.Provider />
    </>
  );
}

const initialViewportWidth = Object.getOwnPropertyDescriptor(window, "innerWidth")!;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  fireEvent(window, new Event("resize"));
}

function openResizableDrawer() {
  const view = render(<Providers />);
  const open = () =>
    act(() =>
      AppDrawer._create(createDrawer, "可调整队列", {
        width: 420,
        resizable: { minWidth: 360, maxWidth: 640 }
      })
    );
  open();
  return {
    ...view,
    open,
    drawer: view.getByRole("dialog", { name: "播放列表" }),
    handle: view.getByRole("separator", { name: "调整抽屉宽度" })
  };
}

function startResize(handle: HTMLElement, clientX = 600) {
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX });
}

function moveResize(clientX: number) {
  fireEvent.pointerMove(document, { pointerId: 1, clientX });
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "innerWidth", initialViewportWidth);
});

it("opens, closes and reopens a non-modal drawer in StrictMode", async () => {
  const view = render(
    <StrictMode>
      <Launcher />
      <Providers />
    </StrictMode>
  );
  fireEvent.click(view.getByRole("button", { name: "打开队列" }));
  const drawer = await view.findByRole("dialog", { name: "播放列表" });
  expect(drawer).toHaveAttribute("aria-modal", "false");
  expect(drawer).toHaveStyle({ width: "420px" });
  expect(view.queryByRole("separator")).not.toBeInTheDocument();
  expect(drawer.parentElement).toHaveClass("top-10!", "bottom-20!", "z-32");
  expect(AppDrawer.__visibleGetter()).toBe(true);

  fireEvent.click(view.getByRole("button", { name: "关闭抽屉" }));
  await waitFor(() => expect(view.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(view.getByRole("button", { name: "打开队列" }));
  expect(await view.findByRole("dialog", { name: "播放列表" })).toHaveTextContent("队列内容");
  fireEvent.click(view.getByRole("button", { name: "关闭抽屉遮罩" }));
  expect(AppDrawer.__visibleGetter()).toBe(false);
});

it("uses fresh content and callbacks when reopening the drawer", async () => {
  const view = render(<Providers />);
  const previousClose = vi.fn();
  const currentClose = vi.fn();
  act(() => AppDrawer._create(createDrawer, "旧队列", { onClose: previousClose }));
  act(() => AppDrawer.close());
  await waitFor(() => expect(AppDrawer.__renderGetter()).toBeNull());

  act(() => AppDrawer._create(createDrawer, "新队列", { onClose: currentClose }));
  expect(view.getByRole("dialog", { name: "播放列表" })).toHaveTextContent("新队列");
  fireEvent.click(view.getByRole("button", { name: "关闭抽屉" }));
  expect(previousClose).not.toHaveBeenCalled();
  expect(currentClose).toHaveBeenCalledOnce();
});

it("respects mask opt-out and an onClose callback that keeps the drawer open", () => {
  const view = render(<Providers />);
  const onClose = vi.fn(() => true);
  act(() => AppDrawer._create(createDrawer, "队列", { closeOnMask: false, onClose }));
  fireEvent.click(view.getByRole("button", { name: "关闭抽屉遮罩" }));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "关闭抽屉" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(AppDrawer.__visibleGetter()).toBe(true);
});

it("keeps the drawer open while Escape closes a song modal or context menu", async () => {
  const view = render(<Providers />);
  act(() => AppDrawer._create(createDrawer, "队列"));
  act(() => AppModal._create(() => ({ title: "歌曲信息", content: "歌曲详情" })));

  fireEvent.keyDown(window, { key: "Escape" });
  expect(AppModal.__visibleGetter()).toBe(false);
  expect(AppDrawer.__visibleGetter()).toBe(true);
  await waitFor(() =>
    expect(view.queryByRole("dialog", { name: "歌曲信息" })).not.toBeInTheDocument()
  );

  act(() =>
    AppContextMenu._create(() => ({
      clientX: 10,
      clientY: 10,
      items: [{ label: "歌曲信息" }]
    }))
  );
  expect(AppContextMenu.__contextMenuVisibleGetter()).toBe(true);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(AppContextMenu.__contextMenuVisibleGetter()).toBe(false);
  expect(AppDrawer.__visibleGetter()).toBe(true);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(AppDrawer.__visibleGetter()).toBe(false);
});

it("retains newly opened content when a previous exit animation finishes", async () => {
  const view = render(<Providers />);
  act(() => AppDrawer._create(createDrawer, "旧队列"));
  act(() => AppDrawer.close());
  act(() => AppDrawer._create(createDrawer, "新队列"));
  await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)));

  expect(view.getByRole("dialog", { name: "播放列表" })).toHaveTextContent("新队列");
  expect(AppDrawer.__renderGetter()?.content).toBe("新队列");
  expect(AppDrawer.__visibleGetter()).toBe(true);
});

it("resizes from the left edge in both directions and clamps to the configured bounds", () => {
  setViewportWidth(1024);
  const { drawer, handle } = openResizableDrawer();
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  expect(handle).toHaveAttribute("aria-orientation", "vertical");
  expect(drawer).toHaveClass("inset-y-2", "right-2", "rounded-xl", "border");

  startResize(handle);
  moveResize(400);
  expect(drawer).toHaveStyle({ width: "620px" });
  moveResize(0);
  expect(drawer).toHaveStyle({ width: "640px" });
  moveResize(800);
  expect(drawer).toHaveStyle({ width: "360px" });
  moveResize(650);
  expect(drawer).toHaveStyle({ width: "370px" });
  fireEvent.pointerUp(document, { pointerId: 1 });

  expect(AppDrawer.__visibleGetter()).toBe(true);
  expect(document.body.style.cursor).toBe(previousCursor);
  expect(document.body.style.userSelect).toBe(previousUserSelect);
  fireEvent.keyDown(handle, { key: "ArrowLeft" });
  expect(drawer).toHaveStyle({ width: "386px" });
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(drawer).toHaveStyle({ width: "370px" });
  fireEvent.keyDown(handle, { key: "Home" });
  expect(drawer).toHaveStyle({ width: "360px" });
  fireEvent.keyDown(handle, { key: "End" });
  expect(drawer).toHaveStyle({ width: "640px" });
});

it("fits the available viewport on open and when the window becomes narrower", () => {
  setViewportWidth(320);
  const { drawer, handle } = openResizableDrawer();
  expect(drawer).toHaveStyle({ width: "304px" });

  setViewportWidth(1024);
  startResize(handle);
  moveResize(0);
  fireEvent.pointerUp(document, { pointerId: 1 });
  expect(drawer).toHaveStyle({ width: "640px" });

  setViewportWidth(500);
  expect(drawer).toHaveStyle({ width: "484px" });
  setViewportWidth(280);
  expect(drawer).toHaveStyle({ width: "264px" });
});

it("cleans up dragging on cancel, blur, close and unmount, then reopens at the default width", async () => {
  setViewportWidth(1024);
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = "crosshair";
  document.body.style.userSelect = "text";
  const { open, drawer, handle, unmount, getByRole } = openResizableDrawer();
  const expectRestoredStyles = () => {
    expect(document.body.style.cursor).toBe("crosshair");
    expect(document.body.style.userSelect).toBe("text");
  };

  try {
    startResize(handle);
    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.body.style.userSelect).toBe("none");
    moveResize(500);
    fireEvent.pointerCancel(document, { pointerId: 1 });
    expectRestoredStyles();
    moveResize(0);
    expect(drawer).toHaveStyle({ width: "520px" });

    startResize(handle);
    fireEvent.blur(window);
    expectRestoredStyles();
    moveResize(0);
    expect(drawer).toHaveStyle({ width: "520px" });

    startResize(handle);
    act(() => AppDrawer.close());
    expectRestoredStyles();
    open();
    moveResize(0);
    expect(drawer).toHaveStyle({ width: "520px" });
    await waitFor(() => expect(getByRole("dialog")).toHaveStyle({ width: "420px" }));

    startResize(getByRole("separator", { name: "调整抽屉宽度" }));
    unmount();
    expectRestoredStyles();
  } finally {
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
  }
});

it("slides the previous drawer out before mounting the next and preserves its width during exit", async () => {
  const view = render(<Providers />);
  act(() =>
    AppDrawer._create(createDrawer, "播放队列", {
      width: 420,
      resizable: { minWidth: 360, maxWidth: 640 }
    })
  );
  fireEvent.keyDown(view.getByRole("separator"), { key: "End" });
  const previous = view.getByRole("dialog", { name: "播放列表" });
  expect(previous).toHaveStyle({ width: "640px" });

  act(() => AppDrawer._create(createDrawer, "收听记录", { title: "听歌足迹", width: 480 }));
  expect(previous).toHaveTextContent("播放队列");
  expect(previous).toHaveStyle({ width: "640px" });
  expect(view.queryByText("收听记录")).not.toBeInTheDocument();
  expect(AppDrawer.__visibleGetter()).toBe(true);

  const next = await view.findByRole("dialog", { name: "听歌足迹" });
  expect(view.queryByRole("dialog", { name: "播放列表" })).not.toBeInTheDocument();
  expect(view.queryByText("播放队列")).not.toBeInTheDocument();
  expect(next).toHaveTextContent("收听记录");
  expect(next).toHaveStyle({ width: "480px" });
});

it("opens only the latest requested drawer when switching quickly", async () => {
  const view = render(<Providers />);
  const mounted = vi.fn();
  function Skipped() {
    mounted();
    return <p>中间内容</p>;
  }
  act(() => AppDrawer._create(createDrawer, "原内容"));
  act(() => {
    AppDrawer._create(createDrawer, <Skipped />);
    AppDrawer._create(createDrawer, "最后内容");
  });
  expect(view.getByRole("dialog")).toHaveTextContent("原内容");
  await waitFor(() => expect(view.getByRole("dialog")).toHaveTextContent("最后内容"));
  expect(mounted).not.toHaveBeenCalled();
});

it("closes a repeated drawer entry without opening the replacement after exit", async () => {
  const view = render(<Providers />);
  act(() => AppDrawer._create(createDrawer, "原队列", { toggleKey: "queue" }));
  act(() => AppDrawer._create(createDrawer, "不应打开的新队列", { toggleKey: "queue" }));
  expect(AppDrawer.__visibleGetter()).toBe(false);
  expect(view.getByRole("dialog")).toHaveTextContent("原队列");
  await waitFor(() => expect(view.queryByRole("dialog")).not.toBeInTheDocument());
  expect(AppDrawer.__renderGetter()).toBeNull();

  act(() => AppDrawer._create(createDrawer, "再次打开队列", { toggleKey: "queue" }));
  expect(view.getByRole("dialog")).toHaveTextContent("再次打开队列");
  expect(AppDrawer.__visibleGetter()).toBe(true);
});

it("cancels a repeated pending entry while another drawer is exiting", async () => {
  const view = render(<Providers />);
  act(() => AppDrawer._create(createDrawer, "播放队列", { toggleKey: "queue" }));
  act(() => AppDrawer._create(createDrawer, "待打开足迹", { toggleKey: "footprint" }));
  act(() => AppDrawer._create(createDrawer, "重复点击足迹", { toggleKey: "footprint" }));
  expect(AppDrawer.__visibleGetter()).toBe(false);
  await waitFor(() => expect(view.queryByRole("dialog")).not.toBeInTheDocument());
  expect(AppDrawer.__renderGetter()).toBeNull();
});

it("can switch back to the exiting drawer when the pending entry is different", async () => {
  const view = render(<Providers />);
  act(() => AppDrawer._create(createDrawer, "原队列", { toggleKey: "queue" }));
  act(() => AppDrawer._create(createDrawer, "听歌足迹", { toggleKey: "footprint" }));
  act(() => AppDrawer._create(createDrawer, "返回队列", { toggleKey: "queue" }));
  expect(AppDrawer.__visibleGetter()).toBe(true);
  await waitFor(() => expect(view.getByRole("dialog")).toHaveTextContent("返回队列"));
  expect(view.queryByText("听歌足迹")).not.toBeInTheDocument();
});

it("cancels a pending replacement when the drawer is explicitly closed", async () => {
  const view = render(<Providers />);
  act(() => AppDrawer._create(createDrawer, "原内容"));
  act(() => AppDrawer._create(createDrawer, "待打开内容"));
  act(() => AppDrawer.close());

  expect(AppDrawer.__visibleGetter()).toBe(false);
  await waitFor(() => expect(view.queryByRole("dialog")).not.toBeInTheDocument());
  expect(view.queryByText("待打开内容")).not.toBeInTheDocument();
  expect(AppDrawer.__renderGetter()).toBeNull();
});

it("cancels a pending replacement with Escape during the exit animation", async () => {
  const view = render(<Providers />);
  act(() => AppDrawer._create(createDrawer, "原内容"));
  act(() => AppDrawer._create(createDrawer, "待打开内容"));
  fireEvent.keyDown(window, { key: "Escape" });

  expect(AppDrawer.__visibleGetter()).toBe(false);
  await waitFor(() => expect(view.queryByRole("dialog")).not.toBeInTheDocument());
  expect(view.queryByText("待打开内容")).not.toBeInTheDocument();
  expect(AppDrawer.__renderGetter()).toBeNull();
});

it("ignores the mask click produced by releasing a resize drag and accepts later clicks", async () => {
  const { handle, getByRole } = openResizableDrawer();
  startResize(handle);
  moveResize(500);
  fireEvent.pointerUp(document, { pointerId: 1 });
  fireEvent.click(getByRole("button", { name: "关闭抽屉遮罩" }));
  expect(AppDrawer.__visibleGetter()).toBe(true);

  await act(() => new Promise((resolve) => window.setTimeout(resolve, 0)));
  fireEvent.click(getByRole("button", { name: "关闭抽屉遮罩" }));
  expect(AppDrawer.__visibleGetter()).toBe(false);
});
