import { render, within, cleanup, fireEvent } from "@testing-library/react";
import VolumeControl from "@mahiru/ui/common/components/data-input/volume-control";

afterEach(cleanup);

it("shows the supplied volume in a horizontal slider and forwards mute and maximum actions", () => {
  const onChange = vi.fn();
  const onToggleMute = vi.fn();
  const view = render(
    <VolumeControl
      className="volume-control-test"
      value={42}
      onChange={onChange}
      onToggleMute={onToggleMute}
    />
  );
  const trigger = view.getByRole("button", { name: "音量 42%" });
  fireEvent.mouseEnter(trigger);
  const panel = view.getByRole("group", { name: "音量调整" });
  const slider = within(panel).getByRole("slider", { name: "音量" });

  expect(trigger.parentElement).toHaveClass("volume-control-test");
  expect(within(panel).getByText("42%")).toBeInTheDocument();
  expect(slider).toHaveAttribute("aria-valuenow", "42");
  expect(slider).toHaveAttribute("aria-valuetext", "42%");
  expect(slider).toHaveAttribute("aria-valuemin", "0");
  expect(slider).toHaveAttribute("aria-valuemax", "100");
  expect(slider).toHaveAttribute("aria-orientation", "horizontal");
  expect(slider).toHaveAttribute("tabindex", "0");

  fireEvent.click(trigger);
  fireEvent.click(within(panel).getByRole("button", { name: "静音" }));
  expect(onToggleMute).toHaveBeenCalledTimes(2);
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.click(within(panel).getByRole("button", { name: "最大音量" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(100);
  expect(slider).toHaveAttribute("aria-valuenow", "42");
});

it("reflects muted and restored props without maintaining a separate audio state", () => {
  const onChange = vi.fn();
  const onToggleMute = vi.fn();
  const view = render(
    <VolumeControl value={0} onChange={onChange} onToggleMute={onToggleMute} muted />
  );
  fireEvent.mouseEnter(view.getByRole("button"));

  expect(view.getAllByRole("button", { name: "取消静音" })).toHaveLength(2);
  for (const button of view.getAllByRole("button", { name: "取消静音" })) {
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
  }
  expect(onToggleMute).toHaveBeenCalledTimes(2);
  expect(view.getByRole("slider")).toHaveAttribute("aria-valuenow", "0");

  view.rerender(
    <VolumeControl value={64} muted={false} onChange={onChange} onToggleMute={onToggleMute} />
  );
  expect(view.getByRole("button", { name: "音量 64%" })).toHaveAttribute("aria-pressed", "false");
  expect(view.getByRole("slider")).toHaveAttribute("aria-valuenow", "64");
  expect(view.getByRole("slider")).toHaveAttribute("aria-valuetext", "64%");
  expect(onChange).not.toHaveBeenCalled();
});

it("uses one-percent keyboard steps and clamps both ends of the volume range", () => {
  const onChange = vi.fn();
  const onToggleMute = vi.fn();
  const view = render(<VolumeControl value={42} onChange={onChange} onToggleMute={onToggleMute} />);
  fireEvent.mouseEnter(view.getByRole("button"));
  const slider = view.getByRole("slider");

  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(onChange).toHaveBeenLastCalledWith(43);
  fireEvent.keyDown(slider, { key: "ArrowLeft" });
  expect(onChange).toHaveBeenLastCalledWith(41);
  fireEvent.keyDown(slider, { key: "Home" });
  expect(onChange).toHaveBeenLastCalledWith(0);
  fireEvent.keyDown(slider, { key: "End" });
  expect(onChange).toHaveBeenLastCalledWith(100);

  view.rerender(<VolumeControl value={100} onChange={onChange} onToggleMute={onToggleMute} />);
  fireEvent.keyDown(slider, { key: "ArrowUp" });
  expect(onChange).toHaveBeenLastCalledWith(100);
  view.rerender(<VolumeControl value={0} onChange={onChange} onToggleMute={onToggleMute} />);
  fireEvent.keyDown(slider, { key: "ArrowDown" });
  expect(onChange).toHaveBeenLastCalledWith(0);
});

it("forwards wheel events from both the trigger and the panel once", () => {
  const onChange = vi.fn();
  const onWheel = vi.fn();
  const view = render(
    <VolumeControl value={42} onWheel={onWheel} onChange={onChange} onToggleMute={vi.fn()} />
  );
  fireEvent.mouseEnter(view.getByRole("button"));

  fireEvent.wheel(view.getByRole("button", { name: "音量 42%" }), { deltaY: -100 });
  expect(onWheel).toHaveBeenCalledTimes(1);
  expect(onWheel.mock.calls[0]?.[0].deltaY).toBe(-100);

  fireEvent.wheel(view.getByRole("slider"), { deltaY: 100 });
  expect(onWheel).toHaveBeenCalledTimes(2);
  expect(onWheel.mock.calls[1]?.[0].deltaY).toBe(100);
  expect(onChange).not.toHaveBeenCalled();
});
