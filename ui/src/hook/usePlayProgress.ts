import { useImmer } from "use-immer";
import { useAnimate } from "motion/react";
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { API } from "@mahiru/ui/api";
import { NCMServerErr } from "@mahiru/ui/utils/errs";
import { PlayerFSMStatusEnum, usePlayerStore } from "@mahiru/ui/store/player";

export function usePlayProgress() {
  const {
    PlayerTrackStatus,
    PlayerCoreGetter,
    PlayerProgressGetter,
    AudioRefGetter,
    PlayerFSMStatus
  } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerProgressGetter",
    "AudioRefGetter",
    "PlayerCoreGetter",
    "PlayerFSMStatus"
  ]);
  const [progress, setProgress] = useImmer({
    percent: 0,
    buffer: 0,
    currentTime: 0,
    duration: 0
  });
  const [percentScope, percentAnimate] = useAnimate();
  const [bufferScope, bufferAnimate] = useAnimate();
  const [isDragging, setIsDragging] = useState(false);
  const [chorus, setChorus] = useState<NeteaseChorusData[]>([]);
  const track = PlayerTrackStatus?.track;
  const player = PlayerCoreGetter();
  const audio = AudioRefGetter();
  const barRef = useRef<HTMLDivElement>(null);
  const dragPercentRef = useRef(0);
  const getPlaying = useRef(PlayerFSMStatus === PlayerFSMStatusEnum.playing);
  const getDragging = useRef(isDragging);
  getDragging.current = isDragging;
  getPlaying.current = PlayerFSMStatus === PlayerFSMStatusEnum.playing;
  // 一次播放同步函数
  const tick = useCallback(
    (force: boolean = false) => {
      if (!force && getDragging.current) return;
      const { buffered, currentTime, duration } = PlayerProgressGetter();
      const percent = !duration ? 0 : (currentTime / duration) * 100;
      const buffer = !duration ? 0 : (buffered / duration) * 100;
      setProgress({ percent, buffer, currentTime, duration });
    },
    [PlayerProgressGetter, setProgress]
  );
  // 监听音频事件，自然更新
  useEffect(() => {
    if (!audio) return;
    const handleTimeUpdate = () => tick();
    const handleLoad = () => tick(true);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadstart", handleLoad);
    audio.addEventListener("progress", handleLoad);
    audio.addEventListener("waiting", handleLoad);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadstart", handleLoad);
      audio.removeEventListener("progress", handleLoad);
      audio.removeEventListener("waiting", handleLoad);
    };
  }, [audio, tick]);
  // 切歌快速重置进度条
  const lastTrackId = useRef(track?.id);
  useEffect(() => {
    if (!track || track.id === lastTrackId.current) return;
    lastTrackId.current = track.id;
    const { duration } = PlayerProgressGetter();
    const nextState = { percent: 0, buffer: 0, currentTime: 0, duration };
    setProgress(nextState);
    if (percentScope.current) {
      percentAnimate(percentScope.current, { width: "0%" }, { duration: 0, ease: "linear" });
    }
    if (bufferScope.current) {
      bufferAnimate(bufferScope.current, { width: "0%" }, { duration: 0, ease: "linear" });
    }
  }, [
    PlayerProgressGetter,
    bufferAnimate,
    bufferScope,
    percentAnimate,
    percentScope,
    setProgress,
    track
  ]);
  // 进度条动画
  useEffect(() => {
    if (!percentScope.current || isDragging) return;
    const duration = getPlaying.current && !document.hidden ? 0.3 : 0;
    percentAnimate(
      percentScope.current,
      { width: `${progress.percent}%` },
      { duration, ease: "linear" }
    );
  }, [progress.percent, percentAnimate, percentScope, isDragging]);
  useEffect(() => {
    if (!bufferScope.current || isDragging) return;
    const duration = progress.buffer <= 1 || document.hidden ? 0 : 0.3;
    bufferAnimate(
      bufferScope.current,
      { width: `${progress.buffer}%` },
      { duration, ease: "linear" }
    );
  }, [progress.buffer, bufferAnimate, bufferScope, isDragging]);
  // 点击和拖拽
  const mouseMoveHandlerRef = useRef<NormalFunc<[MouseEvent]>>(() => {});
  const mouseUpHandlerRef = useRef<NormalFunc<[MouseEvent]>>(() => {});
  const isListenerAttachedRef = useRef(false);
  const calcPercent = useCallback((clientX: number) => {
    const element = barRef.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    return Math.min(100, Math.max(0, percent));
  }, []);
  const handleBarClick = useCallback(
    (e: ReactMouseEvent) => {
      if (isDragging) return;
      const percent = calcPercent(e.clientX);
      dragPercentRef.current = percent;
      const { duration } = PlayerProgressGetter();
      player?.changeCurrentTime?.((percent / 100) * duration);
      setProgress((draft) => {
        draft.percent = percent;
      });
      if (percentScope.current) {
        percentAnimate(
          percentScope.current,
          { width: `${percent}%` },
          { duration: 0, ease: "linear" }
        );
      }
    },
    [
      PlayerProgressGetter,
      calcPercent,
      isDragging,
      percentAnimate,
      percentScope,
      player,
      setProgress
    ]
  );
  const handleBarMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      mouseMoveHandlerRef.current = (e) => {
        const percent = calcPercent(e.clientX);
        dragPercentRef.current = percent;
        setProgress((draft) => {
          draft.percent = percent;
        });
        if (percentScope.current) {
          percentAnimate(
            percentScope.current,
            {
              width: `${percent}%`
            },
            { duration: 0, ease: "linear" }
          );
        }
      };
      mouseUpHandlerRef.current = () => {
        setIsDragging(false);
        const finalPercent = dragPercentRef.current;
        const { duration } = PlayerProgressGetter();
        player?.changeCurrentTime?.((finalPercent / 100) * duration);
        if (isListenerAttachedRef.current) {
          window.removeEventListener("mousemove", mouseMoveHandlerRef.current);
          window.removeEventListener("mouseup", mouseUpHandlerRef.current);
          isListenerAttachedRef.current = false;
        }
      };
      window.addEventListener("mousemove", mouseMoveHandlerRef.current);
      window.addEventListener("mouseup", mouseUpHandlerRef.current);
      isListenerAttachedRef.current = true;
    },
    [PlayerProgressGetter, calcPercent, percentAnimate, percentScope, player, setProgress]
  );
  useEffect(() => {
    return () => {
      if (isListenerAttachedRef.current) {
        try {
          window.removeEventListener("mousemove", mouseMoveHandlerRef.current);
          window.removeEventListener("mouseup", mouseUpHandlerRef.current);
        } catch {
          /*empty*/
        }
        isListenerAttachedRef.current = false;
      }
    };
  }, []);
  // 页面可见性变化时强制更新一次
  useEffect(() => {
    const handleVisibility = () => tick(true);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [tick]);
  // 获取歌曲副歌时间
  useEffect(() => {
    PlayerTrackStatus &&
      API.Track.getTrackChorus(PlayerTrackStatus.track.id)
        .then((response) => {
          if (Array.isArray(response.chorus)) {
            setChorus(response.chorus);
          } else {
            setChorus([]);
          }
        })
        .catch((err) => {
          setChorus([]);
          if (NCMServerErr.eq(err)) {
            // TODO
          }
        });
  }, [PlayerTrackStatus]);
  const chorusPercent = useMemo(() => {
    const duration = PlayerProgressGetter().duration;
    if (!duration || duration <= 0) return [];
    return chorus.map((c) => (c.startTime / (1000 * duration)) * 100);
  }, [PlayerProgressGetter, chorus]);

  return {
    barRef,
    handleBarClick,
    handleBarMouseDown,
    percentScope,
    bufferScope,
    isPlaying: PlayerFSMStatus === PlayerFSMStatusEnum.playing,
    isDragging,
    progress,
    chorus,
    chorusPercent
  };
}
