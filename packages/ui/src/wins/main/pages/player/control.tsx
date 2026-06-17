import { cx } from "@emotion/css";
import { type ComponentProps, type FC, memo, useCallback, useMemo } from "react";
import { createPlayerPlaylistModal } from "@/wins/main/componets/player-playlist-modal";
import {
  ArrowRightLeft,
  ListMusic,
  LoaderCircle,
  type LucideIcon,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward
} from "lucide-react";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AppModal from "@/common/components/display/modal";

import Progress from "./progress";
import { useSetAtom } from "jotai";
import { playModalAtom } from "@/wins/main/atoms/layout";

interface ControlProps {
  className?: string;
  containerClassName?: string;
  itemClassName?: string;
}

const Control: FC<ControlProps> = ({ className, containerClassName, itemClassName }) => {
  const { create } = AppModal.useModal();
  const player = RendererPlayerHandle.usePlayer();
  const setPlayModalAtom = useSetAtom(playModalAtom);
  const openPlaylistModal = useCallback(() => {
    create(createPlayerPlaylistModal, () => {
      setPlayModalAtom(false);
    });
  }, [create, setPlayModalAtom]);

  const centerIcon = useMemo(() => {
    if (player.playing) {
      return (
        <ControlBtn
          icon={Pause}
          fill="currentColor"
          className="scale-85"
          itemClassName={itemClassName}
          onClick={() => player.audio.pause()}
        />
      );
    } else if (player.loading) {
      return (
        <ControlBtn
          icon={LoaderCircle}
          className="animate-spin scale-85"
          itemClassName={itemClassName}
          color="currentColor"
        />
      );
    }
    return (
      <ControlBtn
        icon={Play}
        fill="currentColor"
        className="scale-85"
        itemClassName={itemClassName}
        onClick={() => player.audio.play()}
      />
    );
  }, [itemClassName, player.audio, player.loading, player.playing]);

  return (
    <section className={containerClassName}>
      <Progress />
      <div className={cx("flex justify-between items-center font-bold mt-2", className)}>
        <ControlBtn
          icon={SkipBack}
          className="scale-85"
          itemClassName={itemClassName}
          fill="currentColor"
          onClick={() => player.playlist.last(true)}
        />
        {centerIcon}
        <ControlBtn
          icon={SkipForward}
          className="scale-85"
          itemClassName={itemClassName}
          fill="currentColor"
          onClick={() => player.playlist.next(true)}
        />
        {player.playlist.shuffle ? (
          <ControlBtn
            icon={Shuffle}
            className="scale-85"
            itemClassName={itemClassName}
            fill="currentColor"
            onClick={() => (player.playlist.shuffle = false)}
          />
        ) : (
          <ControlBtn
            icon={ArrowRightLeft}
            fill="currentColor"
            itemClassName={itemClassName}
            onClick={() => (player.playlist.shuffle = true)}
          />
        )}
        {player.playlist.repeat !== "off" ? (
          <ControlBtn
            icon={Repeat1}
            itemClassName={itemClassName}
            onClick={() => (player.playlist.repeat = "off")}
          />
        ) : (
          <ControlBtn
            icon={Repeat2}
            itemClassName={itemClassName}
            onClick={() => (player.playlist.repeat = "one")}
          />
        )}
        <ControlBtn
          icon={ListMusic}
          itemClassName={itemClassName}
          className="scale-85"
          onClick={openPlaylistModal}
        />
      </div>
    </section>
  );
};

export default memo(Control);

const ControlBtn = ({
  icon: Icon,
  onClick,
  className,
  itemClassName,
  ...rest
}: ComponentProps<LucideIcon> & {
  icon: LucideIcon;
  itemClassName?: string;
}) => {
  return (
    <Icon
      className={cx(
        "size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-80",
        className,
        itemClassName
      )}
      onClick={onClick}
      {...rest}
    />
  );
};
