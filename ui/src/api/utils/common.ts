import { isAccountLoggedIn } from "./auth";
import { refreshCookie } from "../auth";
import { usePersistZustandStore } from "@mahiru/ui/store";
import type { NeteaseTrack, NeteaseTrackPrivilege } from "@mahiru/ui/types/netease-api";

export interface TrackPlayableStatus {
  playable: boolean;
  reason: string;
}

function getStoreSnapshot() {
  return usePersistZustandStore.getState();
}

export function isTrackPlayable(track: NeteaseTrack): TrackPlayableStatus {
  const result: TrackPlayableStatus = {
    playable: true,
    reason: ""
  };

  if (track?.privilege?.pl && track.privilege.pl > 0) {
    return result;
  }

  if (isAccountLoggedIn() && track?.privilege?.cs) {
    return result;
  }

  const store = getStoreSnapshot();
  const vipType = store.data.user?.vipType;

  if (track.fee === 1 || track.privilege?.fee === 1) {
    if (isAccountLoggedIn() && vipType === 11) {
      result.playable = true;
    } else {
      result.playable = false;
      result.reason = "VIP Only";
    }
  } else if (track.fee === 4 || track.privilege?.fee === 4) {
    result.playable = false;
    result.reason = "付费专辑";
  } else if (track.noCopyrightRcmd !== null && track.noCopyrightRcmd !== undefined) {
    result.playable = false;
    result.reason = "无版权";
  } else if (track.privilege?.st && track.privilege.st < 0 && isAccountLoggedIn()) {
    result.playable = false;
    result.reason = "已下架";
  }

  return result;
}

export function mapTrackPlayableStatus(
  tracks: NeteaseTrack[] | undefined,
  privileges: NeteaseTrackPrivilege[] = []
): NeteaseTrack[] {
  if (!Array.isArray(tracks)) {
    return tracks ?? [];
  }

  return tracks.map((track) => {
    const privilege = privileges.find((item) => item.id === track.id);
    if (privilege) {
      track.privilege = { ...(track.privilege ?? {}), ...privilege };
    }
    const playable = isTrackPlayable(track);
    track.playable = playable.playable;
    track.reason = playable.reason;
    return track;
  });
}

export function randomNum(minNum: number, maxNum?: number): number {
  if (typeof maxNum === "undefined") {
    return Math.floor(Math.random() * minNum + 1);
  }
  return Math.floor(Math.random() * (maxNum - minNum + 1) + minNum);
}

type Sortable = {
  id: number;
  sort: number;
};

export function shuffleAList(list: Sortable[]): Record<number, number> {
  const sortsList = list.map((item) => item.sort);
  for (let i = 1; i < sortsList.length; i += 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    const current = sortsList[i];
    const swap = sortsList[randomIndex];
    if (typeof current === "undefined" || typeof swap === "undefined") {
      continue;
    }
    sortsList[i] = swap;
    sortsList[randomIndex] = current;
  }

  const newSorts: Record<number, number> = {};
  list.forEach((track) => {
    const nextSort = sortsList.pop();
    if (typeof nextSort !== "undefined") {
      newSorts[track.id] = nextSort;
    }
  });
  return newSorts;
}

export function throttle<T extends (...args: any[]) => void>(fn: T, time: number): T {
  let isRun = false;
  return function throttled(this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (isRun) return;
    isRun = true;
    fn.apply(this, args);
    setTimeout(() => {
      isRun = false;
    }, time);
  } as T;
}

export function updateHttps(url: string | undefined | null): string {
  if (!url) return "";
  return url.replace(/^http:/, "https:");
}

export async function dailyTask(): Promise<void> {
  const store = getStoreSnapshot();
  const lastDate = store.data.lastRefreshCookieDate;
  if (
    isAccountLoggedIn() &&
    (typeof lastDate === "undefined" || lastDate !== new Date().getDate())
  ) {
    console.debug("[debug][common.ts] execute dailyTask");
    try {
      await refreshCookie();
      console.debug("[debug][common.ts] refresh cookie");
      store.updatePersistStoreData({ lastRefreshCookieDate: new Date().getDate() });
    } catch (error) {
      console.debug("[debug][common.ts] refresh cookie failed", error);
    }
  }
}

export function changeAppearance(appearance?: "light" | "dark" | "auto"): void {
  if (typeof document === "undefined") return;
  if (appearance === "auto" || typeof appearance === "undefined") {
    appearance = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.body.setAttribute("data-theme", appearance);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", appearance === "dark" ? "#222" : "#fff");
  }
}

type SplitTitleResult = {
  title: string;
  subtitle: string;
};

export function splitSoundtrackAlbumTitle(title: string): SplitTitleResult {
  const keywords = [
    "Music from the Original Motion Picture Score",
    "The Original Motion Picture Soundtrack",
    "Original MGM Motion Picture Soundtrack",
    "Complete Original Motion Picture Score",
    "Original Music From The Motion Picture",
    "Music From The Disney+ Original Movie",
    "Original Music From The Netflix Film",
    "Original Score to the Motion Picture",
    "Original Motion Picture Soundtrack",
    "Soundtrack from the Motion Picture",
    "Original Television Soundtrack",
    "Original Motion Picture Score",
    "Music From the Motion Picture",
    "Music From The Motion Picture",
    "Complete Motion Picture Score",
    "Music from the Motion Picture",
    "Original Videogame Soundtrack",
    "La Bande Originale du Film",
    "Music from the Miniseries",
    "Bande Originale du Film",
    "Die Original Filmmusik",
    "Original Soundtrack",
    "Complete Score",
    "Original Score"
  ];
  for (const keyword of keywords) {
    if (!title.includes(keyword)) continue;
    return {
      title: title
        .replace(`(${keyword})`, "")
        .replace(`: ${keyword}`, "")
        .replace(`[${keyword}]`, "")
        .replace(`- ${keyword}`, "")
        .replace(`${keyword}`, ""),
      subtitle: keyword
    };
  }
  return {
    title,
    subtitle: ""
  };
}

export function splitAlbumTitle(title: string): SplitTitleResult {
  const keywords = [
    "Bonus Tracks Edition",
    "Complete Edition",
    "Deluxe Edition",
    "Deluxe Version",
    "Tour Edition"
  ];
  for (const keyword of keywords) {
    if (!title.includes(keyword)) continue;
    return {
      title: title
        .replace(`(${keyword})`, "")
        .replace(`: ${keyword}`, "")
        .replace(`[${keyword}]`, "")
        .replace(`- ${keyword}`, "")
        .replace(`${keyword}`, ""),
      subtitle: keyword
    };
  }
  return {
    title,
    subtitle: ""
  };
}

export function bytesToSize(bytes: number): string {
  const marker = 1024;
  const decimal = 2;
  const kiloBytes = marker;
  const megaBytes = marker * marker;
  const gigaBytes = marker * marker * marker;

  const lang = getStoreSnapshot().settings.lang;

  if (bytes < kiloBytes) {
    return `${bytes}${lang === "en" ? " Bytes" : "字节"}`;
  }
  if (bytes < megaBytes) {
    return `${(bytes / kiloBytes).toFixed(decimal)} KB`;
  }
  if (bytes < gigaBytes) {
    return `${(bytes / megaBytes).toFixed(decimal)} MB`;
  }
  return `${(bytes / gigaBytes).toFixed(decimal)} GB`;
}

export function formatTrackTime(value: number | null | undefined): string {
  if (!value) return "";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
