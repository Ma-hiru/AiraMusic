import { ZustandConfig } from "@mahiru/ui/types/zustand";
import { ImageSize } from "@mahiru/ui/utils/filter";

export const DynamicStoreConfig: ZustandConfig<
  DynamicStoreInitialState & DynamicStoreActions,
  DynamicStoreInitialState
> = (set, get) => ({
  ...InitialState,
  getTrackCoverCache(trackID: number, size: ImageSize) {
    const cache = get().trackCoverCache.get(trackID) || [];
    return cache[size] || "";
  },
  setTrackCoverCache(trackID: number, size: ImageSize, cache: string) {
    const old = get().trackCoverCache.get(trackID) || [];
    old[size] = cache;
    get().trackCoverCache.set(trackID, old);
  }
});

const InitialState: DynamicStoreInitialState = {
  trackCoverCache: new Map<number, string[]>()
};

export interface DynamicStoreInitialState {
  trackCoverCache: Map<number, string[]>;
}

export type DynamicStoreActions = {
  getTrackCoverCache: (trackID: number, size: ImageSize) => string;
  setTrackCoverCache: (trackID: number, size: ImageSize, cache: string) => void;
};
