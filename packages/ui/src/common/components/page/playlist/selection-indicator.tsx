import { cx } from "@emotion/css";
import { Trash2, ListPlus } from "lucide-react";
import { memo, type FC, useCallback, type ReactNode } from "react";
import { NeteaseTrackRecord } from "@/common/netease/models";
import AppModal, { createDialogModal } from "@/common/components/display/modal";

interface SelectionIndicatorProps {
  editable: boolean;
  selectAll: NormalFunc;
  selectedIds: Set<number>;
  exitSelection: NormalFunc;
  tracks: readonly NeteaseTrackRecord[];
  onBatchAdd: NormalFunc;
  onBatchDelete: NormalFunc;
}

const SelectionIndicator: FC<SelectionIndicatorProps> = ({
  onBatchAdd,
  onBatchDelete,
  tracks,
  editable,
  selectAll,
  selectedIds,
  exitSelection
}) => {
  const { create } = AppModal.useModal();
  const batchDelete = useCallback(
    () =>
      create(createDialogModal, {
        title: "删除",
        body: "确定要删除选中的歌曲吗？",
        onConfirm: onBatchDelete,
        footer: null,
        important: true
      }),
    [create, onBatchDelete]
  );

  return (
    <div
      className="
        absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3
        rounded-full border border-white/15 bg-black/15 px-4 py-2 text-[12px] font-bold
        shadow-lg backdrop-blur-lg backdrop-saturate-150
      ">
      <TextButton
        text={tracks.length > 0 && selectedIds.size === tracks.length ? "取消全选" : "全选"}
        onClick={selectAll}
      />
      <TextButton text={`已选 ${selectedIds.size}`} disabled />
      <ActionButton
        className="bg-primary text-primary-text"
        disabled={selectedIds.size === 0}
        onClick={onBatchAdd}>
        <ListPlus className="size-3.5" /> 添加
      </ActionButton>
      {editable && (
        <ActionButton
          className="bg-red-500/80 text-white"
          disabled={selectedIds.size === 0}
          onClick={batchDelete}>
          <Trash2 className="size-3.5" /> 删除
        </ActionButton>
      )}
      <TextButton text="取消" onClick={exitSelection} />
    </div>
  );
};

export default memo(SelectionIndicator);

const ActionButton = ({
  className,
  onClick,
  children,
  disabled
}: {
  className?: string;
  disabled?: boolean;
  children?: ReactNode;
  onClick?: NormalFunc;
}) => {
  return (
    <button
      className={cx(
        `
        flex items-center gap-1 rounded-full px-3 py-1
        transition-all duration-300 ease-in-out
        hover:opacity-60 active:scale-98 disabled:opacity-60
        cursor-pointer disabled:cursor-auto disabled:active:scale-100
      `,
        className
      )}
      type="button"
      disabled={disabled}
      onClick={onClick}>
      {children}
    </button>
  );
};

const TextButton = ({
  className,
  onClick,
  text,
  disabled
}: {
  text: string;
  className?: string;
  disabled?: boolean;
  onClick?: NormalFunc;
}) => {
  return (
    <button
      className={cx(
        `
          ease-in-out duration-300 transition-all
          hover:opacity-60 active:scale-98
          cursor-pointer disabled:cursor-auto
          disabled:opacity-60 disabled:active:scale-100
        `,
        className
      )}
      type="button"
      children={text}
      disabled={disabled}
      onClick={onClick}
    />
  );
};
