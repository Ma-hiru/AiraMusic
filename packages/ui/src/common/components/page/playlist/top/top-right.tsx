import { type FC, memo, useCallback } from "react";
import { cx } from "@emotion/css";
import { ListChecks, SquarePen, Trash2 } from "lucide-react";
import { NeteasePlaylist } from "@/common/netease/models";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { Log } from "@/common/lib/log";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";

import Search from "@/common/components/data-input/search";
import PageAction from "@/common/components/display/page-action";

interface TopRightProps {
  summary: Nullable<NeteasePlaylist>;
  editable: boolean;
  searchTracks: NormalFunc<[k: string]>;
  setTying: NormalFunc<[typing: boolean]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
  /** 编辑保存成功后刷新歌单页 */
  onEdited?: NormalFunc;
  /** 删除歌单成功后离开当前页 */
  onDeleted?: NormalFunc;
  selectionMode?: boolean;
  onToggleSelectionMode?: NormalFunc;
}

const TopRight: FC<TopRightProps> = ({
  summary,
  searchTracks,
  editable,
  setTying,
  pageActionType,
  onPageAction,
  onEdited,
  onDeleted,
  selectionMode,
  onToggleSelectionMode
}) => {
  const { create, createPlaylistEditModal, createDialogModal } = AppModal.useModal();

  const confirmDelete = useCallback(async () => {
    if (!summary) return;
    AppModal.close();
    try {
      const res = await NeteaseAPIPlaylist.delete(summary.id);
      if (res.code !== 200) {
        AppToast.show({ type: "error", text: res.message || res.msg || "删除失败" });
        return;
      }
      AppToast.show({ type: "success", text: "已删除歌单" });
      onDeleted?.();
    } catch (err) {
      Log.error(err);
      AppToast.show({ type: "error", text: "删除失败，请重试" });
    }
  }, [summary, onDeleted]);

  const onDelete = useCallback(() => {
    if (!summary) return;
    create(createDialogModal, {
      title: "删除歌单",
      body: `确定要删除歌单「${summary.name}」吗？此操作不可恢复。`,
      onConfirm: confirmDelete,
      footer: null,
      important: true
    });
  }, [summary, create, createDialogModal, confirmDelete]);

  return (
    <div className="flex h-full flex-col justify-between items-end text-[12px]">
      <div className="flex items-center gap-2">
        <ListChecks
          onClick={onToggleSelectionMode}
          className={cx(
            "size-5 cursor-pointer select-none ease-in-out transition-all duration-300",
            selectionMode ? "text-primary-text" : "hover:opacity-50"
          )}
        />
        {editable && (
          <SquarePen
            onClick={() =>
              summary &&
              create(createPlaylistEditModal, {
                playlist: summary,
                onSaved: onEdited,
                onTyping: setTying
              })
            }
            className="size-5 cursor-pointer select-none hover:opacity-50 ease-in-out transition-all duration-300"
          />
        )}
        {editable && (
          <Trash2
            onClick={onDelete}
            className="size-5 cursor-pointer select-none ease-in-out transition-all duration-300 hover:text-red-500"
          />
        )}
        <PageAction type={pageActionType} onClick={onPageAction} />
      </div>
      <div className="flex flex-col items-end justify-end">
        <Search onSearch={searchTracks} setIsTyping={setTying} />
      </div>
    </div>
  );
};

export default memo(TopRight);
