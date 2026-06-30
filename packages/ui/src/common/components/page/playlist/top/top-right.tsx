import { type FC, memo, useCallback } from "react";
import { cx } from "@emotion/css";
import { Ellipsis, ListChecks, RotateCwSquare, SquarePen, Trash2 } from "lucide-react";
import { NeteasePlaylist } from "@/common/netease/models";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { Log } from "@/common/lib/log";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";

import Search from "@/common/components/data-input/search";
import PageAction from "@/common/components/display/page-action";
import IconButton from "@/common/components/data-input/icon-button";

interface TopRightProps {
  editable: boolean;
  summary: Nullable<NeteasePlaylist>;
  source: Nullable<"like" | "normal">;
  searchTracks: NormalFunc<[k: string]>;
  setTying: NormalFunc<[typing: boolean]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
  /** 编辑保存成功后刷新歌单页 */
  onEdited?: Optional<NormalFunc<[modifiedCover: boolean]>>;
  /** 删除歌单成功后离开当前页 */
  onDeleted?: NormalFunc;
  reload?: NormalFunc;
  selectionMode?: boolean;
  onToggleSelectionMode?: NormalFunc;
}

const TopRight: FC<TopRightProps> = ({
  summary,
  source,
  reload,
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
      <div className="flex items-center gap-2 group relative">
        <IconButton
          icon={Ellipsis}
          label="更多"
          size="compact"
          variant="ghost"
          show={editable && source !== "like"}
          className="group-hover:opacity-0 absolute right-21 duration-500! group-hover:duration-0!"
        />
        <IconButton
          icon={SquarePen}
          label="编辑"
          size="compact"
          variant="ghost"
          show={editable && source !== "like"}
          className="scale-94! opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 duration-300!"
          onClick={() =>
            summary &&
            create(createPlaylistEditModal, {
              playlist: summary,
              onSaved: onEdited ?? undefined,
              onTyping: setTying
            })
          }
        />
        <IconButton
          icon={Trash2}
          label="删除"
          size="compact"
          variant="ghost"
          onClick={onDelete}
          show={editable && source !== "like"}
          className="scale-96! opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 duration-300!"
        />
        <IconButton
          icon={ListChecks}
          label="选择"
          size="compact"
          variant="ghost"
          onClick={onToggleSelectionMode}
          className={cx("scale-102!", selectionMode && "text-secondary")}
        />
        <IconButton
          icon={RotateCwSquare}
          label="刷新"
          size="compact"
          variant="ghost"
          onClick={reload}
          className="scale-110!"
        />
        <PageAction
          type={pageActionType}
          size="compact"
          variant="ghost"
          onClick={onPageAction}
          className="scale-98!"
        />
      </div>
      <div className="flex flex-col items-end justify-end">
        <Search onSearch={searchTracks} setIsTyping={setTying} />
      </div>
    </div>
  );
};

export default memo(TopRight);
