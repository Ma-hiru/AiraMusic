export const enum PlayerFSMStatus {
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
  | "loadStart"
  | "loadSuccess"
  | "loadError"
  | "requestNewBegin";

export class PlayerFSM {
  private _current: PlayerFSMStatus;
  constructor(current = PlayerFSMStatus.idle) {
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
  PlayerFSMStatus,
  NormalFunc<[event: PlayerFSMEvent], Undefinable<PlayerFSMStatus>>
> = {
  [PlayerFSMStatus.idle]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying") {
      return PlayerFSMStatus.loading;
    }
  },
  [PlayerFSMStatus.loading]: (event: PlayerFSMEvent) => {
    if (event === "loadSuccess") {
      return PlayerFSMStatus.ready;
    } else if (event === "loadError") {
      return PlayerFSMStatus.error;
    } else if (event === "requestNewBegin") {
      return PlayerFSMStatus.idle;
    }
  },
  [PlayerFSMStatus.ready]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying") {
      return PlayerFSMStatus.playing;
    } else if (event === "requestNewBegin") {
      return PlayerFSMStatus.idle;
    }
  },
  [PlayerFSMStatus.playing]: (event: PlayerFSMEvent) => {
    if (event === "requestPause") {
      return PlayerFSMStatus.paused;
    } else if (event === "playingEnd") {
      return PlayerFSMStatus.ended;
    } else if (event === "playingError") {
      return PlayerFSMStatus.error;
    } else if (event === "requestSeeking") {
      return PlayerFSMStatus.seeking;
    } else if (event === "requestNewBegin") {
      return PlayerFSMStatus.idle;
    }
  },
  [PlayerFSMStatus.paused]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying") {
      return PlayerFSMStatus.playing;
    } else if (event === "requestSeeking") {
      return PlayerFSMStatus.seeking;
    } else if (event === "requestNewBegin") {
      return PlayerFSMStatus.idle;
    }
  },
  [PlayerFSMStatus.seeking]: (event: PlayerFSMEvent) => {
    if (event === "playingStart") {
      return PlayerFSMStatus.playing;
    } else if (event === "playingError") {
      return PlayerFSMStatus.error;
    } else if (event === "requestNewBegin") {
      return PlayerFSMStatus.idle;
    }
  },
  [PlayerFSMStatus.ended]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying" || event === "requestNewBegin") {
      return PlayerFSMStatus.idle;
    }
  },
  [PlayerFSMStatus.error]: (event: PlayerFSMEvent) => {
    if (event === "requestPlaying" || event === "requestNewBegin") {
      return PlayerFSMStatus.idle;
    }
  }
};
