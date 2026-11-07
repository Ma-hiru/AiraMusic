import { memo, useState, useEffect } from "react";
import { RendererFormat } from "@/common/lib/format";
import type RendererPlayerAudio from "@/common/player/audio";

const formatProgress = (audio: RendererPlayerAudio) =>
  `${RendererFormat.duration(audio.progress.currentTime, "s")}/${RendererFormat.duration(audio.progress.duration, "s")}`;

const CurrentTrackProgress = ({ audio }: { audio: RendererPlayerAudio }) => {
  const [progress, setProgress] = useState(() => formatProgress(audio));

  useEffect(() => {
    const update = () => setProgress(formatProgress(audio));
    update();
    audio.addEventListener("timeupdate", update, { passive: true });
    audio.addEventListener("durationchange", update, { passive: true });
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("durationchange", update);
    };
  }, [audio]);

  return (
    <span
      className="whitespace-nowrap text-[11px] tabular-nums opacity-60"
      role="timer"
      aria-label="播放进度">
      {progress}
    </span>
  );
};

export default memo(CurrentTrackProgress);
