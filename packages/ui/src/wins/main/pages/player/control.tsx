import { cx } from "@emotion/css";
import { useSetAtom, useAtomValue } from "jotai";
import { memo, type FC, useMemo, useCallback } from "react";
import {
  Play,
  Pause,
  Trash2,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  ListMusic,
  SkipForward,
  LoaderCircle,
  ArrowRightLeft
} from "lucide-react";
import { fmModeAtom } from "@/wins/main/atoms/track";
import { NeteaseAPITrack } from "@/common/netease/api";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import AppToast from "@/common/components/display/toast";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import IconButton, { type IconButtonProps } from "@/common/components/data-input/icon-button";
import AppModal, {
  type PlaylistModalProps,
  createPlayerPlaylistModal
} from "@/common/components/display/modal";

import Progress from "./progress";

interface ControlProps {
  className?: string;
  itemClassName?: string;
  containerClassName?: string;
}

const Control: FC<ControlProps> = ({ className, itemClassName, containerClassName }) => {
  const { create } = AppModal.useModal();
  const player = RendererPlayerHandle.usePlayer();
  const setPlayModalAtom = useSetAtom(playModalAtom);
  const fmMode = useAtomValue(fmModeAtom);

  const actionRef = useLatestRef<PlaylistModalProps>({
    ...usePageJump(),
    ...usePlayerActionInList(() => player.playlist.list()),
    cacheKey: "player-playlist-player-control"
  });
  const openPlaylistModal = useCallback(() => {
    create(createPlayerPlaylistModal, {
      ...actionRef.current,
      onJumpPage: () => setPlayModalAtom(false)
    });
  }, [actionRef, create, setPlayModalAtom]);

  const dislike = useCallback(() => {
    const current = player.current.track;
    if (!current || !fmMode) return;
    void NeteaseAPITrack.personalFMTrash(current.id);
    player.playlist.remove(current);
    AppToast.show({
      type: "success",
      text: `已移除 ${current.name}`
    });
  }, [fmMode, player]);

  const centerIcon = useMemo(() => {
    if (player.playing) {
      return (
        <ControlBtn
          label="暂停"
          icon={Pause}
          iconClassName="scale-85"
          itemClassName={itemClassName}
          iconProps={{ fill: "currentColor" }}
          onClick={() => player.audio.pause()}
        />
      );
    } else if (player.loading) {
      return (
        <ControlBtn
          className="disabled:opacity-80"
          label="正在加载"
          icon={LoaderCircle}
          color="currentColor"
          itemClassName={itemClassName}
          iconClassName="animate-spin scale-85"
          disabled
        />
      );
    }
    return (
      <ControlBtn
        label="播放"
        icon={Play}
        iconClassName="scale-85"
        itemClassName={itemClassName}
        iconProps={{ fill: "currentColor" }}
        onClick={() => player.audio.play()}
      />
    );
  }, [itemClassName, player.audio, player.loading, player.playing]);

  return (
    <section className={cx("contain-layout", containerClassName)}>
      <Progress />
      <div className={cx("flex justify-between items-center font-bold mt-2", className)}>
        <ControlBtn
          icon={SkipBack}
          disabled={fmMode}
          iconClassName="scale-85"
          itemClassName={itemClassName}
          iconProps={{ fill: "currentColor" }}
          label={fmMode ? "私人 FM 不支持上一首" : "上一首"}
          onClick={() => player.playlist.last(true)}
        />
        {centerIcon}
        <ControlBtn
          label="下一首"
          icon={SkipForward}
          iconClassName="scale-85"
          itemClassName={itemClassName}
          iconProps={{ fill: "currentColor" }}
          onClick={() => player.playlist.next(true)}
        />
        {fmMode && (
          <ControlBtn
            icon={Trash2}
            label="不喜欢这首歌"
            iconClassName="scale-85"
            itemClassName={itemClassName}
            onClick={dislike}
          />
        )}
        {!fmMode &&
          (player.playlist.shuffle ? (
            <ControlBtn
              icon={Shuffle}
              label="关闭随机播放"
              iconClassName="scale-85"
              itemClassName={itemClassName}
              iconProps={{ fill: "currentColor" }}
              onClick={() => (player.playlist.shuffle = false)}
              aria-pressed
            />
          ) : (
            <ControlBtn
              label="开启随机播放"
              aria-pressed={false}
              icon={ArrowRightLeft}
              itemClassName={itemClassName}
              iconProps={{ fill: "currentColor" }}
              onClick={() => (player.playlist.shuffle = true)}
            />
          ))}
        {player.playlist.repeat !== "off" ? (
          <ControlBtn
            icon={Repeat1}
            label="关闭单曲循环"
            itemClassName={itemClassName}
            onClick={() => (player.playlist.repeat = "off")}
            aria-pressed
          />
        ) : (
          <ControlBtn
            icon={Repeat2}
            label="开启单曲循环"
            aria-pressed={false}
            itemClassName={itemClassName}
            onClick={() => (player.playlist.repeat = "one")}
          />
        )}
        <ControlBtn
          label="打开播放队列"
          icon={ListMusic}
          iconClassName="scale-85"
          itemClassName={itemClassName}
          onClick={openPlaylistModal}
        />
      </div>
    </section>
  );
};

export default memo(Control);

const ControlBtn = ({
  className,
  iconClassName,
  itemClassName,
  ...rest
}: IconButtonProps & {
  itemClassName?: string;
}) => {
  return (
    <IconButton
      className={cx(
        `
          text-current
          disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50
        `,
        className
      )}
      size="normal"
      variant="plain"
      iconClassName={cx("size-6", iconClassName, itemClassName)}
      {...rest}
    />
  );
};
