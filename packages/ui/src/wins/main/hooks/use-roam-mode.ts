import { useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { fmModeAtom, fmSessionAtom } from "@/wins/main/atoms/track";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { Log } from "@/common/lib/log";
import AppToast from "@/common/components/display/toast";
import { useUser } from "@/common/store/user";

/** 刷新阈值 */
const REFILL_THRESHOLD = 3;

export function useRoamMode() {
  const [fmMode, setFMMode] = useAtom(fmModeAtom);
  const session = useAtomValue(fmSessionAtom);
  const player = RendererPlayerHandle.player;
  const user = useUser();

  const fmModeRef = useLatestRef(fmMode);
  // 正在拉取，避免并发重复请求
  const fetchingRef = useRef(false);
  // 正在进入漫游，避免"自动退出"在替换队列前误触发
  const startingRef = useRef(false);

  // 开始漫游, session 触发
  useEffect(() => {
    if (session <= 0) return;
    if (!user?.isLoggedIn) {
      AppToast.show({
        type: "info",
        text: "请先登录"
      });
      return;
    }

    let cancelled = false;
    startingRef.current = true;
    fetchingRef.current = true;

    NeteaseServicesTrack.personalFM()
      .then((records) => {
        if (cancelled) return;
        if (records.length === 0) {
          AppToast.show({
            type: "info",
            text: "暂时没有可漫游的歌曲"
          });
          setFMMode(false);
          return;
        }
        player.playlist.replace(records, 0);
      })
      .catch((err) => {
        if (cancelled) return;
        Log.error(err);
        AppToast.show({
          type: "error",
          text: "漫游加载失败"
        });
        setFMMode(false);
      })
      .finally(() => {
        if (cancelled) return;
        fetchingRef.current = false;
        startingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [session, player, setFMMode, user?.isLoggedIn]);

  // 添加歌曲、自动退出
  useEffect(() => {
    const onChange = () => {
      const current = player.current.track;
      const isFM = current?.sourceName === "fm";

      // 切到非漫游内容 → 自动退出
      if (fmModeRef.current && current && !isFM && !startingRef.current) {
        setFMMode(false);
        return;
      }

      // 漫游中且快播完 → 新增 仅以"当前曲来源是 fm"为准，避免误污染普通队列
      if (isFM && !fetchingRef.current) {
        const remaining = player.playlist.list().length - 1 - player.playlist.pos();
        if (remaining < REFILL_THRESHOLD) {
          fetchingRef.current = true;
          NeteaseServicesTrack.personalFM()
            .then((records) => {
              records.length && player.playlist.addList(records);
            })
            .catch((err) => Log.error(err))
            .finally(() => {
              fetchingRef.current = false;
            });
        }
      }
    };

    return player.addListener(onChange);
  }, [player, fmModeRef, setFMMode]);
}
