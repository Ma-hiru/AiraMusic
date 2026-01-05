import { OwnershipLock } from "@mahiru/ui/hook/useLock";
import { useEffect, useRef } from "react";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";
import { Log } from "@mahiru/ui/utils/dev";

export function createSyncHookLock(label?: string) {
  let count = 0;
  const lock = new OwnershipLock();
  const shouldSendWins: Set<WindowType[]> = new Set();
  const getFinalSendWins = () => {
    return Array.from(
      Array.from(shouldSendWins)
        .flat()
        .reduce((winsSet, win) => {
          winsSet.add(win);
          return winsSet;
        }, new Set<WindowType>())
    );
  };

  return function useSyncHookLock(syncWins: WindowType[]) {
    const symbol = useRef<Optional<symbol>>(null);
    const updater = useUpdate();
    const isOwner = useRef(() => lock.isOwner(symbol.current)).current;
    const id = useRef(count++).current;

    useEffect(() => {
      shouldSendWins.add(syncWins);
      return () => {
        shouldSendWins.delete(syncWins);
      };
    }, [syncWins]);

    useEffect(() => {
      const token = lock.acquire();
      Log.trace(label, "id", id, "acquired lock:", token?.toString() || "null");
      symbol.current = token;
      lock.subscribeOwnership(updater);
      return () => {
        lock.release(token);
        lock.unsubscribeOwnership(updater);
      };
    }, [id, updater, updater.count]);

    return {
      getFinalSendWins,
      isOwner
    };
  };
}
