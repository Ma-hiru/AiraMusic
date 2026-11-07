import { memo } from "react";
import { RendererFormat } from "@/common/lib/format";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";

const PlayListProgress = ({ active }: { active: boolean }) => {
  const progressBus = useListenable(RendererIPCMessageBus.progress, !active);
  const progress = progressBus.data;

  return (
    <span
      className="whitespace-nowrap text-[11px] tabular-nums opacity-60"
      role="timer"
      aria-label="播放进度">
      {RendererFormat.duration(progress?.currentTime, "s")}/
      {RendererFormat.duration(progress?.duration, "s")}
    </span>
  );
};

export default memo(PlayListProgress);
