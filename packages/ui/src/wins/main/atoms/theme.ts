import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import RendererTheme from "@/common/player/ui";
import type { MessageData } from "@mahiru/ipc/types";

/** 一次提交封面和取色结果，供其他窗口同步显示。 */
export const themeAtom = atom<MessageData<"bus_deliver_theme">>({
  backgroundCover: undefined,
  theme: { mainColor: RendererTheme.themeDefault.main, themeColors: [] }
});

export const backgroundCoverAtom = atomWithStorage(
  "theme.backgroundCover",
  null as Nullable<string>
);

export const playerBackgroundCoverAtom = atomWithStorage(
  "theme.playerBackgroundCover",
  null as Nullable<string>
);
