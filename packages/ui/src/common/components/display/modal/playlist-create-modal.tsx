import { type FC, useState } from "react";
import { cx } from "@emotion/css";
import { Lock } from "lucide-react";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { Log } from "@/common/lib/log";
import type { ModalRender } from "./modal-provider";
import AppToast from "@/common/components/display/toast";
import AppModal from "./use";
import { NeteaseUser } from "@/common/netease/models";

export function createPlaylistCreateModal({
  onTyping,
  onCreated
}: {
  onTyping?: NormalFunc<[typing: boolean]>;
  onCreated?: NormalFunc<[playlist: NeteaseAPI.NeteasePlaylistSummary]>;
} = {}): ModalRender {
  return {
    title: "新建歌单",
    subTitle: "Create Playlist",
    width: 460,
    content: <PlaylistCreateForm onTyping={onTyping} onCreated={onCreated} />
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const PlaylistCreateForm: FC<{
  onTyping?: NormalFunc<[typing: boolean]>;
  onCreated?: NormalFunc<[playlist: NeteaseAPI.NeteasePlaylistSummary]>;
}> = ({ onTyping, onCreated }) => {
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    if (creating) return;
    const trimmed = name.trim();
    if (!trimmed) {
      AppToast.show({ type: "info", text: "请输入歌单名称" });
      return;
    }
    if (!NeteaseUser.isLoggedIn) {
      AppToast.show({ type: "info", text: "请先登录" });
      return;
    }
    setCreating(true);
    try {
      const res = await NeteaseAPIPlaylist.create({
        name: trimmed,
        privacy: privacy ? 10 : undefined
      });
      if (res.code !== 200) {
        AppToast.show({
          type: "error",
          text: res.message || res.msg || "创建失败"
        });
        return;
      }
      onCreated?.(res.playlist);
      AppToast.show({ type: "success", text: "已创建歌单" });
      AppModal.close();
    } catch (err) {
      Log.error(err);
      AppToast.show({ type: "error", text: "创建失败，请重试" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <input
        autoFocus
        value={name}
        maxLength={40}
        placeholder="歌单名称"
        onFocus={() => onTyping?.(true)}
        onBlur={() => onTyping?.(false)}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void onCreate()}
        className="
          w-full mt-1 rounded-md border border-white/15 bg-white/10 px-3 py-2 font-bold
          outline-none transition-colors focus:border-primary
        "
      />
      {/* 隐私开关 */}
      <button
        type="button"
        onClick={() => setPrivacy((v) => !v)}
        className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10">
        <span className="flex items-center gap-2">
          <Lock className="size-4 opacity-70" />
          <span className="flex flex-col">
            <span className="font-bold">设为隐私歌单</span>
            <span className="text-[11px] opacity-50">仅自己可见（创建后无法转为公开后再转回）</span>
          </span>
        </span>
        <span
          className={cx(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300",
            privacy ? "bg-primary" : "bg-white/20"
          )}>
          <span
            className={cx(
              "absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-300",
              privacy && "translate-x-4"
            )}
          />
        </span>
      </button>
      {/* 操作 */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={creating}
          onClick={onCreate}
          className="
            rounded-md px-4 py-1.5 font-bold hover:text-primary-text hover:bg-primary
            transition-all active:scale-96 disabled:opacity-50
          ">
          {creating ? "创建中..." : "创建"}
        </button>
      </div>
    </div>
  );
};
