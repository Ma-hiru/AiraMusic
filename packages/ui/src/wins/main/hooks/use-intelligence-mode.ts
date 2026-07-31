import { useAtom, useAtomValue } from "jotai";
import { useRef, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { useUser } from "@/common/store/user";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { intelligenceModeAtom, intelligenceSessionAtom } from "@/wins/main/atoms/track";
import AppToast from "@/common/components/display/toast";
import RendererPlayerHandle from "@/wins/main/lib/handle";

/** 刷新阈值 */
const REFILL_THRESHOLD = 3;

export function useIntelligenceMode() {
  const [intelligenceMode, setIntelligenceMode] = useAtom(intelligenceModeAtom);
  const session = useAtomValue(intelligenceSessionAtom);
  const user = useUser();
  const player = RendererPlayerHandle.player;
  const isLoggedIn = user?.isLoggedIn;
  const heartlistID = user?.likedPlaylist.id;

  const intelligenceModeRef = useLatestRef(intelligenceMode);
  const sessionRef = useLatestRef(session);
  const trackRef = useLatestRef({
    currentTrack: player.current.track,
    trackID: player.current.track?.id,
    playlistID: heartlistID
  });
  // 正在拉取，避免并发重复请求
  const fetchingRef = useRef(false);
  // 正在进入心动模式，避免"自动退出"在替换队列前误触发
  const startingRef = useRef(false);
  // 是否是当前 session
  const isSessionCancel = useCallback(
    (current: number) => sessionRef.current !== current,
    [sessionRef]
  );

  // 进入心动模式，保存当前队列
  const hasEnable = useRef(false);
  const hasAutoExit = useRef(false);
  const memoList = useRef<NeteaseTrackRecord[]>([]);
  const memoTrack = useRef<Nullable<NeteaseTrackRecord>>(null);
  const memoMode = useRef({ repeat: player.playlist.repeat, shuffle: player.playlist.shuffle });
  useEffect(() => {
    if (intelligenceMode) {
      Log.info("useIntelligenceMode", "memo list");
      memoList.current = player.playlist.listRaw();
      memoTrack.current = player.current.track;
      memoMode.current = {
        repeat: player.playlist.repeat,
        shuffle: player.playlist.shuffle
      };

      player.playlist.repeat = "off";
      player.playlist.shuffle = false;
      hasEnable.current = true;

      AppToast.show({
        type: "info",
        text: "心动模式开启中..."
      });
    } else if (hasEnable.current) {
      if (!hasAutoExit.current) {
        player.playlist.replace(memoList.current, memoTrack.current ?? undefined);
        player.audio.paused && player.audio.play();
      }
      player.playlist.repeat = memoMode.current.repeat;
      player.playlist.shuffle = memoMode.current.shuffle;
      hasEnable.current = false;
      hasAutoExit.current = false;

      AppToast.show({
        type: "info",
        text: "心动模式已关闭"
      });
    }
  }, [intelligenceMode, player]);

  // 开始推荐, session 触发
  useEffect(() => {
    if (session <= 0) return;
    if (!isLoggedIn) {
      AppToast.show({
        type: "info",
        text: "请先登录"
      });
      return;
    }

    const { trackID, playlistID, currentTrack } = trackRef.current;
    if (!trackID || !playlistID || !currentTrack) {
      AppToast.show({
        type: "info",
        text: "请先播放歌曲"
      });
      return;
    }

    Log.info("useIntelligenceMode", "start recommend");
    const controller = new AbortController();
    const currentSession = session;
    const isCancel = () => controller.signal.aborted || isSessionCancel(currentSession);

    startingRef.current = true;
    fetchingRef.current = true;

    NeteaseServicesPlaylist.intelligence({
      trackID,
      playlistID,
      signal: controller.signal
    })
      .then((records) => {
        if (isCancel()) return;
        if (records.length === 0) {
          AppToast.show({
            type: "info",
            text: "暂时没有推荐的歌曲"
          });
          setIntelligenceMode(false);
          return;
        }
        AppToast.show({
          type: "success",
          text: "心动模式数据加载成功"
        });
        const currentRecord = new NeteaseTrackRecord({
          ...currentTrack,
          sourceID: 0,
          sourceName: "intelligence"
        });
        player.playlist.replace([currentRecord].concat(records), 0);
        player.audio.paused && player.audio.play();
      })
      .catch((err) => {
        if (isCancel()) return;
        Log.error(err);
        AppToast.show({
          type: "error",
          text: "心动模式数据加载失败"
        });
        setIntelligenceMode(false);
      })
      .finally(() => {
        if (isCancel()) return;
        fetchingRef.current = false;
        startingRef.current = false;
      });

    return () => {
      controller.abort();
    };
  }, [
    isLoggedIn,
    isSessionCancel,
    player.audio,
    player.playlist,
    session,
    setIntelligenceMode,
    trackRef
  ]);

  // 自动添加歌曲、自动退出
  useEffect(() => {
    if (!intelligenceMode) return;
    Log.info("useIntelligenceMode", "auto add song");

    let controller = new AbortController();

    const onChange = () => {
      controller.abort();
      controller = new AbortController();

      const current = player.playlist.current();
      const isIntelligence = current?.sourceName === "intelligence";
      // 切到非推荐内容 → 自动退出
      if (intelligenceModeRef.current && current && !isIntelligence && !startingRef.current) {
        console.log(
          "自动退出",
          intelligenceModeRef.current,
          current,
          isIntelligence,
          startingRef.current
        );
        hasAutoExit.current = true;
        return setIntelligenceMode(false);
      }
      // 推荐中且快播完 → 新增 仅以"当前曲来源是 intelligence"为准，避免误污染普通队列
      if (isIntelligence && !fetchingRef.current) {
        const remaining = player.playlist.list().length - 1 - player.playlist.pos();
        if (remaining < REFILL_THRESHOLD) {
          fetchingRef.current = true;
          const currentSession = sessionRef.current;
          const isCancel = () => controller.signal.aborted || isSessionCancel(currentSession);

          const { trackID, playlistID, currentTrack } = trackRef.current;
          if (!trackID || !playlistID || !currentTrack) return;

          NeteaseServicesPlaylist.intelligence({
            trackID,
            playlistID,
            signal: controller.signal
          })
            .then((records) => !isCancel() && records?.length && player.playlist.addList(records))
            .catch((err) => !isCancel() && Log.error(err))
            .finally(() => !isCancel() && (fetchingRef.current = false));
        }
      }
    };

    const unsub = player.addListener(onChange);
    return () => {
      unsub();
      controller.abort();
    };
  }, [
    intelligenceMode,
    intelligenceModeRef,
    isSessionCancel,
    player,
    sessionRef,
    setIntelligenceMode,
    trackRef
  ]);
}
