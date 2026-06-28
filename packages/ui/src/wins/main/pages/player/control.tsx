import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useMemo } from "react";
import { createPlayerPlaylistModal } from "@/wins/main/componets/player-playlist-modal";
import {
  ArrowRightLeft,
  ListMusic,
  LoaderCircle,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2
} from "lucide-react";
import { NeteaseAPITrack } from "@/common/netease/api";
import { useAtomValue, useSetAtom } from "jotai";
import { fmModeAtom } from "@/wins/main/atoms/track";
import { playModalAtom } from "@/wins/main/atoms/layout";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";

import IconButton, { type IconButtonProps } from "@/common/components/data-input/icon-button";
import Progress from "./progress";

interface ControlProps {
  className?: string;
  containerClassName?: string;
  itemClassName?: string;
}

const Control: FC<ControlProps> = ({ className, containerClassName, itemClassName }) => {
  const { create } = AppModal.useModal();
  const player = RendererPlayerHandle.usePlayer();
  const setPlayModalAtom = useSetAtom(playModalAtom);
  const fmMode = useAtomValue(fmModeAtom);
  const openPlaylistModal = useCallback(() => {
    create(createPlayerPlaylistModal, () => {
      setPlayModalAtom(false);
    });
  }, [create, setPlayModalAtom]);

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
          icon={Pause}
          label="暂停"
          iconProps={{ fill: "currentColor" }}
          iconClassName="scale-85"
          itemClassName={itemClassName}
          onClick={() => player.audio.pause()}
        />
      );
    } else if (player.loading) {
      return (
        <ControlBtn
          icon={LoaderCircle}
          label="正在加载"
          disabled
          className="disabled:opacity-80"
          iconClassName="animate-spin scale-85"
          itemClassName={itemClassName}
          color="currentColor"
        />
      );
    }
    return (
      <ControlBtn
        icon={Play}
        label="播放"
        iconProps={{ fill: "currentColor" }}
        iconClassName="scale-85"
        itemClassName={itemClassName}
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
          label={fmMode ? "私人 FM 不支持上一首" : "上一首"}
          disabled={fmMode}
          iconClassName="scale-85"
          itemClassName={itemClassName}
          iconProps={{ fill: "currentColor" }}
          onClick={() => player.playlist.last(true)}
        />
        {centerIcon}
        <ControlBtn
          icon={SkipForward}
          label="下一首"
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
              aria-pressed
              iconClassName="scale-85"
              itemClassName={itemClassName}
              iconProps={{ fill: "currentColor" }}
              onClick={() => (player.playlist.shuffle = false)}
            />
          ) : (
            <ControlBtn
              icon={ArrowRightLeft}
              label="开启随机播放"
              aria-pressed={false}
              iconProps={{ fill: "currentColor" }}
              itemClassName={itemClassName}
              onClick={() => (player.playlist.shuffle = true)}
            />
          ))}
        {player.playlist.repeat !== "off" ? (
          <ControlBtn
            icon={Repeat1}
            label="关闭单曲循环"
            aria-pressed
            itemClassName={itemClassName}
            onClick={() => (player.playlist.repeat = "off")}
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
          icon={ListMusic}
          label="打开播放队列"
          itemClassName={itemClassName}
          iconClassName="scale-85"
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
      size="normal"
      variant="plain"
      className={cx(
        `
          text-current
          disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50
        `,
        className
      )}
      iconClassName={cx("size-6", iconClassName, itemClassName)}
      {...rest}
    />
  );
};
