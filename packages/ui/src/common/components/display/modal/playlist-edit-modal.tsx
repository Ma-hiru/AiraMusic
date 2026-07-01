import { cx } from "@emotion/css";
import { Lock, Globe, ImagePlus } from "lucide-react";
import { useRef, type FC, useState, useEffect, useCallback, type ChangeEvent } from "react";
import { Log } from "@/common/lib/log";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { type NeteasePlaylist, NeteasePlaylistSummary } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";

import AppModal from "./use";
import type { ModalRender } from "./modal-provider";

/** 标签上限 */
const MAX_TAGS = 3;

export function createPlaylistEditModal({
  onSaved,
  onTyping,
  playlist
}: {
  playlist: NeteasePlaylist;
  onTyping: NormalFunc<[typing: boolean]>;
  onSaved?: NormalFunc<[modifiedCover: boolean]>;
}): ModalRender {
  return {
    title: "编辑歌单",
    subTitle: "Edit Playlist",
    width: 800,
    content: <PlaylistEditForm playlist={playlist} onSaved={onSaved} onTyping={onTyping} />
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const PlaylistEditForm: FC<{
  playlist: NeteasePlaylist;
  onTyping: NormalFunc<[typing: boolean]>;
  onSaved?: NormalFunc<[modifiedCover: boolean]>;
}> = ({ onSaved, onTyping, playlist }) => {
  const [name, setName] = useState(playlist.name);
  const [desc, setDesc] = useState(playlist.description ?? "");
  const [tags, setTags] = useState<string[]>(() => [...(playlist.tags ?? [])]);
  const [officialTags, setOfficialTags] = useState<string[]>([]);
  const [coverFile, setCoverFile] = useState<Nullable<File>>(null);
  const [preview, setPreview] = useState(playlist.coverImgUrl);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(() => NeteasePlaylistSummary.isPrivacy(playlist));
  const [confirmingPublic, setConfirmingPublic] = useState(false);
  const [settingPublic, setSettingPublic] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 拉取官方标签
  useEffect(() => {
    NeteaseServicesPlaylist.categories()
      .then(setOfficialTags)
      .catch((err) => Log.error(err));
  }, []);

  // 释放本地预览 URL
  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onPickFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      AppToast.show({
        type: "error",
        text: "请选择图片文件"
      });
      return;
    }
    setCoverFile(file);
    setPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_TAGS) {
        AppToast.show({
          type: "info",
          text: `最多选择 ${MAX_TAGS} 个标签`
        });
        return prev;
      }
      return [...prev, tag];
    });
  }, []);

  const onSave = useCallback(async () => {
    if (saving) return;
    if (!name.trim()) {
      AppToast.show({
        type: "info",
        text: "请输入歌单名称"
      });
      return;
    }
    setSaving(true);
    try {
      await NeteaseAPIPlaylist.updateInfo({
        id: playlist.id,
        name: name.trim(),
        desc: desc.trim(),
        tags
      });
      if (coverFile) await NeteaseAPIPlaylist.updateCover(playlist.id, coverFile);
      onSaved?.(!!coverFile);
      AppToast.show({
        type: "success",
        text: "已保存"
      });
      AppModal.close();
    } catch (err) {
      Log.error(err);
      AppToast.show({
        type: "error",
        text: "保存失败，请重试"
      });
    } finally {
      setSaving(false);
    }
  }, [coverFile, desc, name, onSaved, playlist.id, saving, tags]);

  const onSetPublic = useCallback(async () => {
    if (settingPublic) return;
    setSettingPublic(true);
    try {
      const res = await NeteaseAPIPlaylist.setPublic(playlist.id);
      if (res.code !== 200) {
        AppToast.show({ type: "info", text: res.message || res.msg || "操作失败" });
        return;
      }
      setIsPrivate(false);
      setConfirmingPublic(false);
      onSaved?.(false);
      AppToast.show({ type: "success", text: "已设为公开" });
    } catch (err) {
      Log.error(err);
      AppToast.show({ type: "error", text: "操作失败，请重试" });
    } finally {
      setSettingPublic(false);
    }
  }, [onSaved, playlist.id, settingPublic]);

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <input ref={fileRef} className="hidden" type="file" accept="image/*" onChange={onPickFile} />
      <div className="flex gap-4 items-center">
        {/* 封面 */}
        <button
          className="group relative aspect-square size-33 shrink-0 overflow-hidden rounded-lg bg-white/10 outline-none"
          title="更换封面"
          type="button"
          onClick={() => fileRef.current?.click()}>
          <img className="size-full object-cover" alt={name} src={preview} />
          <span
            className="
              absolute inset-0 flex flex-col items-center justify-center gap-1
              bg-black/40 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100
            ">
            <ImagePlus className="size-5" />
            <span className="text-[11px] font-bold">更换封面</span>
          </span>
        </button>
        {/* 名称 + 简介 */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <input
            className="
              w-full rounded-md border border-white/15 bg-white/10 px-3 py-2 font-bold
              outline-none transition-colors focus:border-primary
            "
            value={name}
            maxLength={40}
            placeholder="歌单名称"
            onBlur={() => onTyping(false)}
            onFocus={() => onTyping(true)}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="
              h-20 w-full resize-none rounded-md border border-white/15 bg-white/10 px-3 py-2
              outline-none transition-colors scrollbar scrollbar-show focus:border-primary
            "
            value={desc}
            maxLength={1000}
            placeholder="歌单简介"
            onBlur={() => onTyping(false)}
            onFocus={() => onTyping(true)}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
      </div>
      {/* 标签 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-bold opacity-70">标签</span>
          <span className="text-[11px] opacity-50">
            已选 {tags.length}/{MAX_TAGS}
          </span>
        </div>
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto scrollbar scrollbar-show">
          {officialTags.length === 0 ? (
            <span className="text-[12px] opacity-50">加载标签中...</span>
          ) : (
            officialTags.map((tag) => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  className={cx(
                    "rounded-md px-2 py-1 text-[11px] font-bold transition-all duration-300",
                    active ? "bg-primary text-primary-text" : "bg-white/10 hover:bg-white/20"
                  )}
                  type="button"
                  onClick={() => toggleTag(tag)}>
                  {tag}
                </button>
              );
            })
          )}
        </div>
      </div>
      {/* 可见性 */}
      <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
        <span className="flex items-center gap-2">
          {isPrivate ? (
            <Lock className="size-4 opacity-70" />
          ) : (
            <Globe className="size-4 opacity-70" />
          )}
          <span className="flex flex-col">
            <span className="font-bold">{isPrivate ? "隐私歌单" : "公开歌单"}</span>
            <span className="text-[11px] opacity-50">
              {isPrivate ? "仅自己可见" : "已公开，网易云不支持转回隐私"}
            </span>
          </span>
        </span>
        {isPrivate &&
          (confirmingPublic ? (
            <span className="flex items-center gap-2">
              <button
                className="
                  rounded-md bg-primary px-3 py-1 font-bold text-primary-text
                  transition-all active:scale-96 disabled:opacity-50
                "
                type="button"
                disabled={settingPublic}
                onClick={onSetPublic}>
                {settingPublic ? "处理中..." : "确认公开（不可撤销）"}
              </button>
              <button
                className="rounded-md px-3 py-1 font-bold hover:bg-white/10 transition-all active:scale-96 disabled:opacity-50"
                type="button"
                disabled={settingPublic}
                onClick={() => setConfirmingPublic(false)}>
                取消
              </button>
            </span>
          ) : (
            <button
              className="
                rounded-md px-3 py-1 font-bold hover:text-primary-text hover:bg-primary
                transition-all active:scale-96
              "
              type="button"
              onClick={() => setConfirmingPublic(true)}>
              设为公开
            </button>
          ))}
      </div>
      {/* 操作 */}
      <div className="flex justify-end gap-2">
        <button
          className="
            rounded-md px-4 py-1.5 font-bold hover:text-primary-text hover:bg-primary
            transition-all active:scale-96 disabled:opacity-50
          "
          type="button"
          disabled={saving}
          onClick={onSave}>
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
};
