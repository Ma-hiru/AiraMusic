import { cx } from "@emotion/css";
import { memo, type FC, useMemo, Fragment, useState, useEffect, useCallback } from "react";
import {
  Play,
  Disc3,
  Heart,
  Pause,
  Music2,
  Trash2,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  HeartPulse,
  SkipForward,
  LoaderCircle,
  ArrowRightLeft
} from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { useHeart } from "@/common/hooks/use-heart";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseAPITrack } from "@/common/netease/api";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { NeteaseTrack, NeteaseNetworkImage } from "@/common/netease/models";
import Tag from "@/common/components/display/tag";
import Marquee from "@/common/components/display/marquee";
import NoDrag from "@/common/components/layout/drag/no-drag";
import NeteaseImage from "@/common/components/display/image/netease-image";
import IconButton, { type IconButtonProps } from "@/common/components/data-input/icon-button";

interface RadioMetaProps {
  className?: string;
}

const RadioMeta: FC<RadioMetaProps> = ({ className }) => {
  const progressBus = useListenable(RendererIPCMessageBus.progress);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);

  const isPlaying = trackMetaBus.data?.status === "playing";
  const quality = useMemo(
    () => RendererFormat.quality(trackMetaBus.data?.quality),
    [trackMetaBus.data?.quality]
  );
  const cover = useMemo(() => {
    return NeteaseNetworkImage.fromTrackCover(trackMetaBus.data?.track?.detail)?.setSize(
      NeteaseImageSize.md
    );
  }, [trackMetaBus.data?.track?.detail]);
  const track = useMemo(
    () =>
      trackMetaBus.data?.track?.detail
        ? NeteaseTrack.fromObject(trackMetaBus.data?.track?.detail)
        : undefined,
    [trackMetaBus.data?.track?.detail]
  );
  const title = useMemo(() => {
    if (!track) return;
    return {
      alias: track.aliaName,
      translate: track.translate,
      ...track.splitTitle()
    };
  }, [track]);

  const [redCount, setRedCount] = useState<Nullable<number>>(null);
  const { heartManager } = useUserTrackManager();
  const { checkLiked, likedChange } = useHeart(heartManager);
  const starTrack = useCallback(() => {
    if (!track) return;
    const liked = likedChange(track);
    if (liked) setRedCount((r) => (r ?? 1) - 1);
  }, [likedChange, track]);
  const openArtist = useCallback(async (id: number) => {
    await RendererWindow.display.reactReadyAwait();
    return RendererIPCMessageBus.display.deliver({
      type: "artist",
      id
    });
  }, []);
  useEffect(() => {
    const id = track?.id;
    if (!id) {
      setRedCount(null);
      return;
    }

    let cancel = false;
    NeteaseAPITrack.redCount(id)
      .then((res) => {
        if (cancel) return;
        setRedCount(res.data.count);
      })
      .catch(() => {
        if (cancel) return;
        setRedCount(null);
      });
    return () => {
      cancel = true;
    };
  }, [track?.id]);

  const fmMode = trackMetaBus.data?.mode === "fm";
  const intelligenceMode = trackMetaBus.data?.mode === "intelligence";
  const repeat = trackMetaBus.data?.repeat;
  const shuffle = trackMetaBus.data?.shuffle;
  const status = trackMetaBus.data?.status;
  const centerIcon = useMemo(() => {
    if (status === "playing") {
      return (
        <ControlBtn
          label="暂停"
          icon={Pause}
          iconClassName="scale-85"
          iconProps={{ fill: "currentColor" }}
          onClick={() => RendererIPCMessageBus.playerAction.deliver("pause")}
        />
      );
    } else if (status === "loading") {
      return (
        <ControlBtn
          className="disabled:opacity-80"
          label="正在加载"
          icon={LoaderCircle}
          color="currentColor"
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
        iconProps={{ fill: "currentColor" }}
        onClick={() => RendererIPCMessageBus.playerAction.deliver("play")}
      />
    );
  }, [status]);

  return (
    <section className={cx(className, "flex flex-col justify-center items-center gap-px")}>
      {/* Title */}
      <section className="w-35 shrink-0 overflow-hidden">
        <Marquee
          className="opacity-50 text-[9.5px] text-center"
          text={title?.translate ?? title?.alias ?? title?.sub}
          options={{
            speed: 15,
            pingPong: true,
            pauseOnHover: true,
            gapDuration: 2000
          }}
        />
        <Marquee
          className="font-bold text-center text-[11.5px]"
          text={title?.main}
          options={{
            speed: 10,
            pingPong: true,
            pauseOnHover: true,
            gapDuration: 2000
          }}
        />
      </section>
      {/* Cover */}
      <NoDrag
        className="
          h-35 w-35 shrink-0 relative overflow-hidden rounded-md
          hover:scale-102 cursor-pointer mt-0.5
          ease-in-out duration-300 transition-all
        ">
        {cover ? (
          <NeteaseImage
            className="size-full aspect-square"
            image={cover}
            shadowColor="light"
            title={track?.al.name}
            cache
            preview
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-white/50">
            <Music2 className="size-5" />
          </div>
        )}
        <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary">
          <Disc3 className={cx("size-4 text-primary-text", isPlaying && "animate-spin")} />
        </span>
      </NoDrag>
      {/* Info */}
      <NoDrag className="flex mt-1 w-35 shrink-0 justify-center items-center gap-1 overflow-hidden">
        <div className="flex-1">
          {quality && (
            <Tag
              className="w-fit! text-normal-text! bg-(--text-color)/30! text-[8px]"
              text={quality}
            />
          )}
        </div>
        <div
          className={cx(
            `
              flex justify-center items-center gap-1 bg-white/30 rounded-sm
              px-1 py-px hover:opacity-50 active:scale-98 cursor-pointer
              ease-in-out duration-300 transition-all
           `,
            redCount === null && "bg-transparent! px-0!"
          )}
          onClick={starTrack}>
          {redCount !== null && (
            <span className="text-[8px] leading-normal">{RendererFormat.count(redCount)}</span>
          )}
          <Heart
            className="size-3"
            color={checkLiked(track) ? "currentColor" : undefined}
            fill={checkLiked(track) ? "currentColor" : "transparent"}
          />
        </div>
      </NoDrag>
      {/* Progress */}
      <NoDrag className="flex mt-1 w-35 text-[10px] shrink-0 gap-2 justify-between items-center">
        <Marquee
          className="flex-1 flex gap-1 items-center"
          options={{
            speed: 20,
            pingPong: true,
            pauseOnHover: true,
            gapDuration: 2000
          }}>
          {track?.ar?.map((a, index) => {
            return (
              <Fragment key={a.id}>
                <a
                  className="hover:opacity-50 cursor-pointer active:scale-98 ease-in-out duration-300 transition-all truncate"
                  onClick={() => openArtist(a.id)}>
                  {a.name}
                </a>
                {index < track?.ar.length - 1 && (
                  <span className="opacity-80 font-medium mx-0.5">/</span>
                )}
              </Fragment>
            );
          })}
        </Marquee>
        <span>
          {RendererFormat.duration(
            ((progressBus.data?.duration || 0) - (progressBus.data?.currentTime || 0)) * 1000
          )}
        </span>
      </NoDrag>
      {/* Control */}
      <NoDrag className="flex w-35 justify-between items-center font-bold">
        <ControlBtn
          icon={SkipBack}
          disabled={fmMode}
          iconClassName="scale-85"
          iconProps={{ fill: "currentColor" }}
          label={fmMode ? "私人 FM 不支持上一首" : "上一首"}
          onClick={() => RendererIPCMessageBus.playerAction.deliver("previous")}
        />
        {centerIcon}
        <ControlBtn
          label="下一首"
          icon={SkipForward}
          iconClassName="scale-85"
          iconProps={{ fill: "currentColor" }}
          onClick={() => RendererIPCMessageBus.playerAction.deliver("next")}
        />
        {fmMode ? (
          <ControlBtn
            icon={Trash2}
            label="不喜欢这首歌"
            iconClassName="scale-85"
            onClick={() => RendererIPCMessageBus.playlistAction.deliver({ type: "fmModeDislike" })}
          />
        ) : intelligenceMode ? (
          <ControlBtn
            label="关闭心动模式"
            icon={HeartPulse}
            iconClassName="scale-85"
            onClick={() =>
              RendererIPCMessageBus.playlistAction.deliver({
                type: "intelligenceMode",
                value: false
              })
            }
          />
        ) : (
          <ControlBtn
            iconClassName="scale-85"
            iconProps={{ fill: "currentColor" }}
            label={shuffle ? "关闭随机播放" : "开启随机播放"}
            icon={shuffle ? Shuffle : ArrowRightLeft}
            onClick={() =>
              RendererIPCMessageBus.playlistAction.deliver({
                type: "shuffleMode",
                value: !shuffle
              })
            }
          />
        )}
        <ControlBtn
          icon={repeat !== "off" ? Repeat1 : Repeat2}
          label={repeat !== "off" ? "关闭单曲循环" : "开启单曲循环"}
          onClick={() =>
            RendererIPCMessageBus.playlistAction.deliver({
              type: "repeatMode",
              value: repeat !== "off" ? "off" : "one"
            })
          }
        />
      </NoDrag>
    </section>
  );
};

export default memo(RadioMeta);

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
      size="compact"
      variant="plain"
      iconClassName={cx("size-4.5!", iconClassName, itemClassName)}
      {...rest}
    />
  );
};
