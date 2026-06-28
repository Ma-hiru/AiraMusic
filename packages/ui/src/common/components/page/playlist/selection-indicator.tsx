import { cx } from "@emotion/css";
import { type FC, memo, type ReactNode } from "react";
import { ListPlus, Trash2 } from "lucide-react";
import { NeteaseTrackRecord } from "@/common/netease/models";

interface SelectionIndicatorProps {
  selectAll: NormalFunc;
  onBatchAdd: NormalFunc;
  onBatchDelete: NormalFunc;
  exitSelection: NormalFunc;
  tracks: readonly NeteaseTrackRecord[];
  selectedIds: Set<number>;
  editable: boolean;
}

const SelectionIndicator: FC<SelectionIndicatorProps> = ({
  selectAll,
  onBatchAdd,
  onBatchDelete,
  exitSelection,
  tracks,
  selectedIds,
  editable
}) => {
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
      <TextButton disabled text={`已选 ${selectedIds.size}`} />
      <ActionButton
        onClick={onBatchAdd}
        className="bg-primary text-primary-text"
        disabled={selectedIds.size === 0}>
        <ListPlus className="size-3.5" /> 添加
      </ActionButton>
      {editable && (
        <ActionButton
          onClick={onBatchDelete}
          className="bg-red-500/80 text-white"
          disabled={selectedIds.size === 0}>
          <Trash2 className="size-3.5" /> 删除
        </ActionButton>
      )}
      <TextButton text="取消" onClick={exitSelection} />
    </div>
  );
};

export default memo(SelectionIndicator);

const ActionButton = ({
  onClick,
  disabled,
  className,
  children
}: {
  onClick?: NormalFunc;
  className?: string;
  disabled?: boolean;
  children?: ReactNode;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        `
        flex items-center gap-1 rounded-full px-3 py-1
        transition-all duration-300 ease-in-out
        hover:opacity-60 active:scale-98 disabled:opacity-60
        cursor-pointer disabled:cursor-auto disabled:active:scale-100
      `,
        className
      )}>
      {children}
    </button>
  );
};

const TextButton = ({
  onClick,
  text,
  className,
  disabled
}: {
  text: string;
  onClick?: NormalFunc;
  className?: string;
  disabled?: boolean;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        `
          ease-in-out duration-300 transition-all
          hover:opacity-60 active:scale-98
          cursor-pointer disabled:cursor-auto
          disabled:opacity-60 disabled:active:scale-100
        `,
        className
      )}
      children={text}
    />
  );
};
