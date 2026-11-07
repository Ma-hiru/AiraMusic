import { ListMusic } from "lucide-react";
import { render, cleanup, fireEvent } from "@testing-library/react";
import Control from "@mahiru/ui/common/components/layout/top/control";
import IconButton from "@mahiru/ui/common/components/data-input/icon-button";

vi.mock("@/common/lib/device", () => ({
  RendererDevice: { platform: Promise.resolve("darwin") }
}));
vi.mock("@/common/lib/window", () => ({
  RendererWindow: {
    current: { isPin: false },
    process: { listenMessage: () => vi.fn() }
  }
}));
vi.mock("@/common/hooks/use-listenable", () => ({ useListenable: (value: unknown) => value }));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));

afterEach(cleanup);

it("retains the existing button configuration API and click actions", () => {
  const onClick = vi.fn();
  const view = render(
    <Control exit={false} appends={{ icon: ListMusic, label: "播放列表", onClick }} dev pin />
  );
  expect(view.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
    "打开开发者工具",
    "播放列表",
    "窗口置顶"
  ]);
  fireEvent.click(view.getByRole("button", { name: "播放列表" }));
  expect(onClick).toHaveBeenCalledOnce();
});

it("places a component append in the same control row without an additional wrapper", () => {
  const onClick = vi.fn();
  const view = render(
    <Control
      exit={false}
      appends={
        <IconButton
          label="播放列表"
          size="compact"
          variant="plain"
          icon={ListMusic}
          onClick={onClick}
        />
      }
      dev
      pin
    />
  );
  const buttons = view.getAllByRole("button");
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    "打开开发者工具",
    "播放列表",
    "窗口置顶"
  ]);
  expect(buttons[1]!.parentElement).toBe(buttons[0]!.parentElement);
  expect(buttons[1]!.parentElement).toBe(buttons[2]!.parentElement);
  fireEvent.click(buttons[1]!);
  expect(onClick).toHaveBeenCalledOnce();
});
