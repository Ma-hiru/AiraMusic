import { render, cleanup, fireEvent } from "@testing-library/react";
import { createDialogModal } from "@mahiru/ui/common/components/display/modal";
import SelectionIndicator from "@mahiru/ui/common/components/page/playlist-v2/selection-indicator";
import LegacySelectionIndicator from "@mahiru/ui/common/components/page/playlist/selection-indicator";
import type { NeteaseTrackRecord } from "@mahiru/ui/common/netease/models";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/common/components/display/modal", () => ({
  default: { useModal: () => ({ create: mocks.create }) },
  createDialogModal: vi.fn()
}));

const layouts = [
  {
    name: "legacy",
    Component: LegacySelectionIndicator,
    classes: ["bottom-3", "bg-black/15", "backdrop-saturate-150"]
  },
  {
    name: "detailed",
    Component: SelectionIndicator,
    classes: ["bottom-6!", "bg-black/60!", "backdrop-saturate-200!"]
  }
];
const tracks = [{ id: 1 }, { id: 2 }] as NeteaseTrackRecord[];

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it.each(layouts)(
  "preserves $name styling and shared selection actions",
  ({ classes, Component }) => {
    const props = {
      tracks,
      editable: true,
      className: "custom-selection",
      selectedIds: new Set([1]),
      selectAll: vi.fn(),
      exitSelection: vi.fn(),
      onBatchAdd: vi.fn(),
      onBatchDelete: vi.fn()
    };
    const view = render(<Component {...props} />);
    const toolbar = view.getByRole("button", { name: "全选" }).parentElement!;
    expect(toolbar).toHaveClass("custom-selection", ...classes);
    expect(view.getByRole("button", { name: "已选 1" })).toBeDisabled();

    fireEvent.click(view.getByRole("button", { name: "全选" }));
    fireEvent.click(view.getByRole("button", { name: "添加" }));
    fireEvent.click(view.getByRole("button", { name: "取消" }));
    expect(props.selectAll).toHaveBeenCalledOnce();
    expect(props.onBatchAdd).toHaveBeenCalledOnce();
    expect(props.exitSelection).toHaveBeenCalledOnce();

    fireEvent.click(view.getByRole("button", { name: "删除" }));
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
      createDialogModal,
      expect.objectContaining({ important: true, onConfirm: props.onBatchDelete })
    );
    expect(props.onBatchDelete).not.toHaveBeenCalled();
    const dialog = mocks.create.mock.calls[0]![1] as { onConfirm: () => void };
    dialog.onConfirm();
    expect(props.onBatchDelete).toHaveBeenCalledOnce();

    view.rerender(<Component {...props} editable={false} selectedIds={new Set([1, 2])} />);
    expect(view.getByRole("button", { name: "取消全选" })).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
  }
);

it.each(layouts)("disables $name batch changes when the selection is empty", ({ Component }) => {
  const onBatchAdd = vi.fn();
  const view = render(
    <Component
      tracks={tracks}
      selectAll={vi.fn()}
      exitSelection={vi.fn()}
      selectedIds={new Set()}
      onBatchAdd={onBatchAdd}
      onBatchDelete={vi.fn()}
      editable
    />
  );
  expect(view.getByRole("button", { name: "添加" })).toBeDisabled();
  expect(view.getByRole("button", { name: "删除" })).toBeDisabled();
  fireEvent.click(view.getByRole("button", { name: "添加" }));
  expect(onBatchAdd).not.toHaveBeenCalled();
});
