import { atom } from "jotai";

export const fmModeAtom = atom(false);
/** 漫游会话计数，每次点击 漫游 自增，用于重新拉取数据 */
export const fmSessionAtom = atom(0);
export const heartModeAtom = atom(false);
