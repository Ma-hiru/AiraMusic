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

export class PlayerFSM {
  private _current: PlayerFSMStatusEnum;
  constructor(current = PlayerFSMStatusEnum.idle) {
    this._current = current;
  }

  get current() {
    return this._current;
  }

  next(event: PlayerFSMEvent) {
    this._current = caseMap[this._current](event) || this._current;
    return this;
  }
}

const caseMap: Record<
  PlayerFSMStatusEnum,
  NormalFunc<[event: PlayerFSMEvent], Undefinable<PlayerFSMStatusEnum>>
> = {
  [PlayerFSMStatusEnum.idle]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying") {
      return PlayerFSMStatusEnum.loading;
    }
  },
  [PlayerFSMStatusEnum.loading]: (event: PlayerFSMEvent) => {
    if (event === "loadSuccess") {
      return PlayerFSMStatusEnum.ready;
    } else if (event === "loadError") {
      return PlayerFSMStatusEnum.error;
    } else if (event === "requestRestart") {
      return PlayerFSMStatusEnum.idle;
    }
  },
  [PlayerFSMStatusEnum.ready]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying") {
      return PlayerFSMStatusEnum.playing;
    } else if (event === "requestRestart") {
      return PlayerFSMStatusEnum.idle;
    }
  },
  [PlayerFSMStatusEnum.playing]: (event: PlayerFSMEvent) => {
    if (event === "requestPause") {
      return PlayerFSMStatusEnum.paused;
    } else if (event === "playingEnd") {
      return PlayerFSMStatusEnum.ended;
    } else if (event === "playingError") {
      return PlayerFSMStatusEnum.error;
    } else if (event === "requestSeeking") {
      return PlayerFSMStatusEnum.seeking;
    } else if (event === "requestRestart") {
      return PlayerFSMStatusEnum.idle;
    }
  },
  [PlayerFSMStatusEnum.paused]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying") {
      return PlayerFSMStatusEnum.playing;
    } else if (event === "requestSeeking") {
      return PlayerFSMStatusEnum.seeking;
    } else if (event === "requestRestart") {
      return PlayerFSMStatusEnum.idle;
    }
  },
  [PlayerFSMStatusEnum.seeking]: (event: PlayerFSMEvent) => {
    if (event === "playingStart") {
      return PlayerFSMStatusEnum.playing;
    } else if (event === "playingError") {
      return PlayerFSMStatusEnum.error;
    } else if (event === "requestRestart") {
      return PlayerFSMStatusEnum.idle;
    }
  },
  [PlayerFSMStatusEnum.ended]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying" || event === "requestRestart") {
      return PlayerFSMStatusEnum.idle;
    }
  },
  [PlayerFSMStatusEnum.error]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying" || event === "requestRestart") {
      return PlayerFSMStatusEnum.idle;
    }
  }
};
