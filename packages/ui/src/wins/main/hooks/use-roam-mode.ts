import { useAtom, useAtomValue } from "jotai";
import { useRef, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { useUser } from "@/common/store/user";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { fmModeAtom, fmSessionAtom } from "@/wins/main/atoms/track";
import AppToast from "@/common/components/display/toast";
import RendererPlayerHandle from "@/wins/main/lib/handle";

/** 刷新阈值 */
const REFILL_THRESHOLD = 3;

export function useRoamMode() {
  const [fmMode, setFMMode] = useAtom(fmModeAtom);
  const session = useAtomValue(fmSessionAtom);
  const user = useUser();
  const player = RendererPlayerHandle.player;
  const isLoggedIn = user?.isLoggedIn;

  const fmModeRef = useLatestRef(fmMode);
  const sessionRef = useLatestRef(session);
  // 正在拉取，避免并发重复请求
  const fetchingRef = useRef(false);
  // 正在进入漫游，避免"自动退出"在替换队列前误触发
  const startingRef = useRef(false);
  // 是否是当前 session
  const isSessionCancel = useCallback(
    (current: number) => sessionRef.current !== current,
    [sessionRef]
  );

  // 进入漫游模式
  const hasEnable = useRef(false);
  const memoMode = useRef({ repeat: player.playlist.repeat, shuffle: player.playlist.shuffle });
  useEffect(() => {
    if (fmMode) {
      memoMode.current = {
        repeat: player.playlist.repeat,
        shuffle: player.playlist.shuffle
      };

      player.playlist.repeat = "off";
      player.playlist.shuffle = false;
      hasEnable.current = true;

      AppToast.show({
        type: "info",
        text: "漫游模式开启中..."
      });
    } else if (hasEnable.current) {
      player.playlist.repeat = memoMode.current.repeat;
      player.playlist.shuffle = memoMode.current.shuffle;
      hasEnable.current = false;

      AppToast.show({
        type: "info",
        text: "漫游模式已关闭"
      });
    }
  }, [fmMode, player]);

  // 开始漫游, session 触发
  useEffect(() => {
    if (session <= 0) return;
    if (!isLoggedIn) {
      AppToast.show({
        type: "info",
        text: "请先登录"
      });
      return;
    }

    const controller = new AbortController();
    const currentSession = session;
    const isCancel = () => controller.signal.aborted || isSessionCancel(currentSession);

    startingRef.current = true;
    fetchingRef.current = true;

    NeteaseServicesTrack.personalFM(controller.signal)
      .then((records) => {
        if (isCancel()) return;
        if (records.length === 0) {
          AppToast.show({
            type: "info",
            text: "暂时没有可漫游的歌曲"
          });
          setFMMode(false);
          return;
        }
        AppToast.show({
          type: "success",
          text: "漫游加载成功"
        });
        player.playlist.replace(records, 0);
        player.audio.paused && player.audio.play();
      })
      .catch((err) => {
        if (isCancel()) return;
        Log.error(err);
        AppToast.show({
          type: "error",
          text: "漫游加载失败"
        });
        setFMMode(false);
      })
      .finally(() => {
        if (isCancel()) return;
        fetchingRef.current = false;
        startingRef.current = false;
      });

    return () => {
      controller.abort();
    };
  }, [isLoggedIn, isSessionCancel, player.audio, player.playlist, session, setFMMode]);

  // 自动添加歌曲、自动退出
  useEffect(() => {
    if (!fmMode) return;

    let controller = new AbortController();

    const onChange = () => {
      controller.abort();
      controller = new AbortController();

      const current = player.current.track;
      const isFM = current?.sourceName === "fm";
      // 切到非漫游内容 → 自动退出
      if (fmModeRef.current && current && !isFM && !startingRef.current) {
        AppToast.show({
          type: "info",
          text: "已退出漫游"
        });
        return setFMMode(false);
      }
      // 漫游中且快播完 → 新增 仅以"当前曲来源是 fm"为准，避免误污染普通队列
      if (isFM && !fetchingRef.current) {
        const remaining = player.playlist.list().length - 1 - player.playlist.pos();
        if (remaining < REFILL_THRESHOLD) {
          fetchingRef.current = true;
          const currentSession = sessionRef.current;
          const isCancel = () => controller.signal.aborted || isSessionCancel(currentSession);

          NeteaseServicesTrack.personalFM(controller.signal)
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
  }, [fmMode, fmModeRef, isSessionCancel, player, sessionRef, setFMMode]);
}
