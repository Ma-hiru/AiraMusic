import { Dispatch, SetStateAction, useCallback, useMemo } from "react";
import { PlayerTrackInfo } from "@mahiru/ui/ctx/PlayerCtx";
import { Lock } from "./useLock";
import { Updater } from "use-immer";
import { Log } from "@mahiru/ui/utils/dev";

type SongPlaylist = {
  TransitionLock: Lock;
  currentIndex: number;
  setPlayList: Updater<PlayerTrackInfo[]>;
  isShuffle: boolean;
  setInfo: Updater<PlayerTrackInfo>;
  playList: PlayerTrackInfo[];
  setCurrentIndex: Dispatch<SetStateAction<number>>;
};

export function useSongPlaylist({
  TransitionLock,
  currentIndex,
  setPlayList,
  isShuffle,
  setInfo,
  playList,
  setCurrentIndex
}: SongPlaylist) {
  Log.trace("useSongPlaylist executed");
  const addTrackToList = useCallback(
    (newTrack: PlayerTrackInfo) => {
      TransitionLock.run(() => {
        const exists = playList.findIndex((t) => t.id === newTrack.id);
        if (exists === -1) {
          // 不存在则添加到列表尾
          setPlayList((draft) => {
            draft.push(newTrack);
          });
        } else {
          // 已存在则提前到列表头
          setPlayList((draft) => {
            const [track] = draft.splice(exists, 1);
            draft.unshift(track!);
          });
          // 由于歌曲被提前到列表头，currentIndex 需要更新
          if (exists < currentIndex) {
            // 如果原先的索引在播放索引的前面，那么无需修改 currentIndex，因为播放位置不变
            TransitionLock.unlock();
            return;
          } else if (exists === currentIndex) {
            // 如果原先的索引就是播放索引，那么 currentIndex 同步提前为 0
            setCurrentIndex(() => 0);
            return;
          } else if (exists > currentIndex) {
            // 如果原先的索引在播放索引的后面，那么 currentIndex 需要加一
            setCurrentIndex((index) => index + 1);
            return;
          }
        }
        TransitionLock.unlock();
      }, false);
    },
    [TransitionLock, currentIndex, playList, setCurrentIndex, setPlayList]
  );

  const removeTrackInList = useCallback(
    (id: number) => {
      TransitionLock.run(() => {
        setPlayList((draft) => {
          const index = draft.findIndex((t) => t.id === id);
          // 如果删除的歌曲合法（在列表中）
          if (index !== -1) {
            // 如果删除的歌曲在播放中，切换到下一首
            if (index === currentIndex) {
              // 如果是最后一首，切换到第一首
              if (index === draft.length - 1) {
                setCurrentIndex(() => 0);
                return;
              } else {
                // 否则切换到下一首，由于 splice 之后，
                // 下一首的 index 会和当前相同，所以不需要修改 currentIndex，
                // 这里显示操作是为了触发更新，因为index没有变化但是内容变了
                setCurrentIndex(() => index);
                return;
              }
            }
            draft.splice(index, 1);
          }
          TransitionLock.unlock();
        });
      }, false);
    },
    [TransitionLock, currentIndex, setCurrentIndex, setPlayList]
  );

  const addAndPlayTrack = useCallback(
    (newTrack: PlayerTrackInfo) => {
      TransitionLock.run(() => {
        const exists = playList.findIndex((t) => t.id === newTrack.id);
        if (exists === -1) {
          const insertAt = Math.min(currentIndex + 1, playList.length);
          const newPlayList = [
            ...playList.slice(0, insertAt),
            newTrack,
            ...playList.slice(insertAt)
          ];
          setPlayList(newPlayList);
          if (isShuffle) {
            setInfo(newTrack);
            TransitionLock.unlock();
          } else {
            setCurrentIndex(() => insertAt);
          }
        } else {
          if (exists === currentIndex) {
            TransitionLock.unlock();
            return;
          }
          setCurrentIndex(() => exists);
        }
      }, false);
    },
    [TransitionLock, currentIndex, isShuffle, playList, setCurrentIndex, setInfo, setPlayList]
  );
  const clearPlayList = useCallback(() => {
    TransitionLock.run(() => {
      setPlayList([]);
      setCurrentIndex(() => 0);
    }, false);
  }, [TransitionLock, setCurrentIndex, setPlayList]);

  const replacePlayList = useCallback(
    (playList: PlayerTrackInfo[], relativeIndex: number) => {
      TransitionLock.run(() => {
        setPlayList(playList);
        if (isShuffle) {
          const shouldPlayTrack = playList[relativeIndex]!;
          setInfo(shouldPlayTrack);
          TransitionLock.unlock();
        } else {
          setCurrentIndex(() => relativeIndex);
        }
      }, false);
    },
    [TransitionLock, isShuffle, setCurrentIndex, setInfo, setPlayList]
  );

  return useMemo(
    () => ({
      addTrackToList,
      removeTrackInList,
      addAndPlayTrack,
      clearPlayList,
      replacePlayList
    }),
    [addAndPlayTrack, addTrackToList, clearPlayList, removeTrackInList, replacePlayList]
  );
}
