import { act, render, cleanup, fireEvent } from "@testing-library/react";
import Version from "@mahiru/ui/common/components/page/settings/aside/version";

const { send, showToast, createMenu } = vi.hoisted(() => ({
  send: vi.fn(),
  showToast: vi.fn(),
  createMenu: vi.fn()
}));
vi.mock("@mahiru/ipc/renderer", () => ({ RendererIPC: { NormalChannel: { send } } }));
vi.mock("@/common/components/display/toast", () => ({ default: { show: showToast } }));
vi.mock("@/common/components/display/menu", () => ({
  default: { useMenu: () => ({ create: createMenu }) }
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

function openMenu() {
  const view = render(<Version />);
  const button = view.getByRole("button", { name: "导出日志" });
  fireEvent.click(button);
  const menu = createMenu.mock.calls[0]![0]();
  expect(menu.items.map((item: { label: string }) => item.label)).toEqual([
    "最近 10 份日志",
    "全部日志"
  ]);
  return { button, menu };
}

it.each([
  [0, "recent"],
  [1, "all"]
])(
  "exports the selected scope and prevents duplicate requests while pending (%s)",
  async (index, scope) => {
    let finish!: (result: { ok: boolean }) => void;
    send.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const { menu, button } = openMenu();

    act(() => {
      menu.items[index as number].onClick();
      menu.items[index as number].onClick();
    });
    expect(send).toHaveBeenCalledExactlyOnceWith("invoke_log_export", scope);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("导出中");

    await act(async () => finish({ ok: true }));
    expect(button).toBeEnabled();
    expect(showToast).toHaveBeenCalledWith({ type: "success", text: "日志已导出" });
  }
);

it("silently restores the button after canceling the save dialog", async () => {
  send.mockResolvedValue({ ok: false, canceled: true });
  const { menu, button } = openMenu();
  await act(async () => menu.items[0].onClick());

  expect(button).toBeEnabled();
  expect(showToast).not.toHaveBeenCalled();
});

it("shows the main-process error and restores the button", async () => {
  send.mockResolvedValue({ ok: false, error: "暂无日志可导出" });
  const { menu, button } = openMenu();
  await act(async () => menu.items[0].onClick());

  expect(button).toBeEnabled();
  expect(showToast).toHaveBeenCalledWith({ type: "error", text: "暂无日志可导出" });
});
