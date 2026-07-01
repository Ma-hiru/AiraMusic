import { cx } from "@emotion/css";
import { memo, type FC, useCallback } from "react";
import { Trash2, Ellipsis, SquarePen, ListChecks, RotateCwSquare } from "lucide-react";
import { Log } from "@/common/lib/log";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { NeteasePlaylist } from "@/common/netease/models";
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
  pageActionType?: "out" | "none" | "enter";
  setTying: NormalFunc<[typing: boolean]>;
  onPageAction?: NormalFunc;
  /** 编辑保存成功后刷新歌单页 */
  onEdited?: Optional<NormalFunc<[modifiedCover: boolean]>>;
  /** 删除歌单成功后离开当前页 */
  reload?: NormalFunc;
  selectionMode?: boolean;
  onDeleted?: NormalFunc;
  onToggleSelectionMode?: NormalFunc;
}

const TopRight: FC<TopRightProps> = ({
  source,
  pageActionType,
  setTying,
  onEdited,
  onDeleted,
  onPageAction,
  onToggleSelectionMode,
  reload,
  summary,
  editable,
  searchTracks,
  selectionMode
}) => {
  const { create, createDialogModal, createPlaylistEditModal } = AppModal.useModal();

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
          className="group-hover:opacity-0 absolute right-21 duration-500! group-hover:duration-0!"
          label="更多"
          size="compact"
          icon={Ellipsis}
          variant="ghost"
          show={editable && source !== "like"}
        />
        <IconButton
          className="scale-94! opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 duration-300!"
          label="编辑"
          size="compact"
          variant="ghost"
          icon={SquarePen}
          show={editable && source !== "like"}
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
          className="scale-96! opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 duration-300!"
          label="删除"
          icon={Trash2}
          size="compact"
          variant="ghost"
          show={editable && source !== "like"}
          onClick={onDelete}
        />
        <IconButton
          className={cx("scale-102!", selectionMode && "text-secondary")}
          label="选择"
          size="compact"
          variant="ghost"
          icon={ListChecks}
          onClick={onToggleSelectionMode}
        />
        <IconButton
          className="scale-110!"
          label="刷新"
          size="compact"
          variant="ghost"
          icon={RotateCwSquare}
          onClick={reload}
        />
        <PageAction
          className="scale-98!"
          size="compact"
          variant="ghost"
          type={pageActionType}
          onClick={onPageAction}
        />
      </div>
      <div className="flex flex-col items-end justify-end">
        <Search setIsTyping={setTying} onSearch={searchTracks} />
      </div>
    </div>
  );
};

export default memo(TopRight);
