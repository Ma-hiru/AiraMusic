import { act, render, within, cleanup, fireEvent } from "@testing-library/react";
import Tooltip from "@mahiru/ui/common/components/display/tooltip";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("keeps the default tooltip in its existing container", () => {
  const view = render(
    <Tooltip content="说明">
      <button>触发</button>
    </Tooltip>
  );

  expect(view.container).toContainElement(view.getByRole("tooltip"));
  expect(view.getByRole("tooltip")).toHaveClass("opacity-0", "group-hover/tooltip:opacity-100");
});

it("mounts a visible portal only while hovering and keeps the padded bridge interactive", () => {
  const onMouseEnter = vi.fn();
  const onMouseLeave = vi.fn();
  const view = render(
    <Tooltip
      tooltipLabel="操作"
      tooltipRole="group"
      content={<button>浮层操作</button>}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      portal
      interactive>
      <button>触发</button>
    </Tooltip>
  );
  const trigger = view.getByRole("button", { name: "触发" });
  vi.spyOn(trigger.parentElement!, "getBoundingClientRect").mockReturnValue(
    new DOMRect(200, 400, 20, 20)
  );
  expect(view.queryByRole("group")).not.toBeInTheDocument();

  fireEvent.mouseEnter(trigger);
  const panel = view.getByRole("group", { name: "操作" });
  const anchor = panel.parentElement;
  expect(view.container).not.toContainElement(panel);
  expect(anchor?.parentElement).toBe(document.body);
  expect(anchor).toHaveStyle({ left: "200px", top: "400px", width: "20px", height: "20px" });
  expect(anchor).toHaveClass("fixed", "z-50", "pointer-events-none");
  expect(panel).toHaveClass("pointer-events-auto", "opacity-100", "pb-3");
  expect(onMouseEnter).toHaveBeenCalledTimes(1);

  fireEvent.mouseLeave(trigger, { relatedTarget: panel });
  fireEvent.mouseEnter(panel, { relatedTarget: trigger });
  expect(view.getByRole("group")).toBe(panel);
  fireEvent.mouseLeave(panel, { relatedTarget: document.body });
  expect(onMouseLeave).toHaveBeenCalled();
  expect(view.queryByRole("group")).not.toBeInTheDocument();
  expect(anchor).not.toBeInTheDocument();
});

it("keeps the portal visible while dragging outside and removes it on release", () => {
  const view = render(
    <Tooltip content={<button>浮层操作</button>} portal interactive>
      <button>触发</button>
    </Tooltip>
  );
  fireEvent.mouseEnter(view.getByRole("button", { name: "触发" }));
  const panel = view.getByRole("tooltip");

  fireEvent.mouseDown(panel);
  fireEvent.mouseLeave(panel, { relatedTarget: document.body });
  expect(view.getByRole("tooltip")).toBe(panel);
  fireEvent.mouseUp(window);
  expect(view.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("bridges Tab through portal controls and returns to the next visible trigger sibling", () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
    this: HTMLElement
  ) {
    return (this.hidden ? [] : [new DOMRect(0, 0, 20, 20)]) as unknown as DOMRectList;
  });
  const onFocus = vi.fn();
  const onBlur = vi.fn();
  const onKeyDown = vi.fn();
  const view = render(
    <>
      <Tooltip
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        content={
          <>
            <button>静音</button>
            <div tabIndex={0} role="slider" aria-label="音量" />
            <button>最大音量</button>
          </>
        }
        portal
        interactive>
        <button>触发</button>
      </Tooltip>
      <button hidden>隐藏按钮</button>
      <button>后续按钮</button>
    </>
  );
  const trigger = view.getByRole("button", { name: "触发" });
  act(() => trigger.focus());
  const panel = view.getByRole("tooltip");
  const first = within(panel).getByRole("button", { name: "静音" });
  const last = within(panel).getByRole("button", { name: "最大音量" });

  fireEvent.keyDown(trigger, { key: "Tab" });
  expect(first).toHaveFocus();
  expect(view.getByRole("tooltip")).toBe(panel);
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(trigger).toHaveFocus();
  expect(view.getByRole("tooltip")).toBe(panel);

  act(() => last.focus());
  fireEvent.keyDown(last, { key: "Tab" });
  expect(view.getByRole("button", { name: "后续按钮" })).toHaveFocus();
  expect(view.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(onFocus).toHaveBeenCalled();
  expect(onBlur).toHaveBeenCalled();
  expect(onKeyDown).toHaveBeenCalledTimes(3);
});

it("updates its fixed anchor on window resize and scrolling and closes on window blur", () => {
  const view = render(
    <Tooltip content="说明" portal>
      <button>触发</button>
    </Tooltip>
  );
  const trigger = view.getByRole("button");
  const measure = vi
    .spyOn(trigger.parentElement!, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(200, 400, 20, 20));
  fireEvent.mouseEnter(trigger);
  const anchor = view.getByRole("tooltip").parentElement;

  measure.mockReturnValue(new DOMRect(180, 350, 20, 20));
  fireEvent.resize(window);
  expect(anchor).toHaveStyle({ left: "180px", top: "350px" });
  measure.mockReturnValue(new DOMRect(160, 300, 20, 20));
  fireEvent.scroll(document);
  expect(anchor).toHaveStyle({ left: "160px", top: "300px" });

  fireEvent.blur(window);
  expect(anchor).not.toBeInTheDocument();
});
