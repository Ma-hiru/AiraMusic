export const enum PlayerFSMStatusEnum {
  idle = 1,
  loading,
  ready,
  playing,
  paused,
  seeking,
  ended,
  error
}

export type PlayerFSMEvent =
  | "requestPlaying"
  | "playingStart"
  | "playingEnd"
  | "playingError"
  | "requestPause"
  | "requestSeeking"
  | "loadSuccess"
  | "loadError"
  | "requestRestart";
