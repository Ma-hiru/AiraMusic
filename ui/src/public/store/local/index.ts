import { debounce } from "lodash-es";
import { TrackQuality } from "@mahiru/ui/public/enum";
import { Log } from "@mahiru/ui/public/utils/dev";
import { Errs } from "@mahiru/ui/public/entry/errs";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import { useEffect, useMemo, useRef } from "react";

export interface LocalStoreState {
  User: {
    LastRefreshCookiesDay: Nullable<number>;
    UserProfile: Nullable<NeteaseUserDetailResponse["profile"]>;
    UserLoginMode: Nullable<"account" | "username">;
    UserLikedTrackIDs: { ids: Record<number, boolean>; checkPoint: number };
    UserLikedPlaylistID: Nullable<number>;
  };
  Settings: {
    MusicQuality: TrackQuality;
    MaxHistoryListLength: number;
  };
  version: number;
}

export interface WithLocalStore {
  readonly localSnapshot: LocalStoreState;
  readonly localProxy: LocalStoreState;
}

export class LocalStoreClass {
  private version = 1;
  private state!: LocalStoreState;
  private shell = {} as LocalStoreState;
  private stateKey = "LOCAL_STORE";
  private updateTimeKey = "LOCAL_STORE_UPDATE_TIME";
  private updateTime: Nullable<string> = null;
  private subscriber = new Set<NormalFunc<[state: LocalStoreState]>>();
  private readonly syncDebounce;

  constructor() {
    this.read();
    this.update();
    this.syncDebounce = debounce(this.sync.bind(this));
  }

  /**
   * 检查本地存储状态是否过期
   *
   * 过期包括：未初始化、存储时间戳不匹配、未加载
   * */
  private get outdate() {
    const time = localStorage.getItem(this.updateTimeKey);
    return time ? this.updateTime !== time : true;
  }

  private update() {
    if (this.state.version < this.version) {
      // todo
      this.state.version = this.version;
    }
  }

  private parse(state: string) {
    try {
      return <LocalStoreState>JSON.parse(state);
    } catch (err) {
      const e = Errs.LocalParseErr.create("LocalStore", err);
      Log.error(e);
      throw e;
    }
  }

  private read(): LocalStoreState {
    if (!this.outdate) return this.state;
    const state = localStorage.getItem(this.stateKey);
    if (state === null) {
      // 如果没有存储的状态，则返回默认状态，同时初始化
      return this.sync(this.default());
    } else {
      // 尝试解析存储的状态
      return this.sync(this.parse(state));
    }
  }

  private sync(state = this.state, time = Date.now()) {
    this.state = state;
    this.updateTime = time.toString();
    localStorage.setItem(this.stateKey, JSON.stringify(this.state));
    localStorage.setItem(this.updateTimeKey, this.updateTime);
    requestIdleCallback(() => this.execSubscriber(), { timeout: 1000 });
    return this.state;
  }

  private execSubscriber() {
    for (const cb of this.subscriber) {
      try {
        cb(this.state);
      } catch (err) {
        Log.error(Errs.LocalSubscriberErr.create("LocalStore", err));
        this.subscriber.delete(cb);
      }
    }
  }

  private proxyCache = new WeakMap<object, any>();

  private createDeepProxy<T extends object>(target: T): T {
    if (this.proxyCache.has(target)) {
      return this.proxyCache.get(target);
    }

    const proxy = new Proxy(target, {
      get: (t, prop, receiver) => {
        const value = Reflect.get(t, prop, receiver);
        if (typeof value === "function") {
          return value.bind(receiver);
        }
        if (typeof value === "object" && value !== null) {
          return this.createDeepProxy(value);
        }
        return value;
      },
      set: (t, prop, value, receiver) => {
        const ok = Reflect.set(t, prop, value, receiver);
        this.syncDebounce();
        return ok;
      },
      deleteProperty: (t, prop) => {
        const ok = Reflect.deleteProperty(t, prop);
        this.syncDebounce();
        return ok;
      }
    });

    this.proxyCache.set(target, proxy);
    return proxy;
  }

  public set<T extends keyof LocalStoreState>(store: T, data: Partial<LocalStoreState[T]>) {
    const old = this.read()[store];
    if (typeof old === "object") {
      Object.assign(old, data);
    } else {
      throw Errs.LocalSetErr.create();
    }
    this.syncDebounce();
  }

  public subscribe(cb: NormalFunc<[state: LocalStoreState]>) {
    this.subscriber.add(cb);
    return () => {
      this.subscriber.delete(cb);
    };
  }

  public proxy() {
    return new Proxy(this.shell, {
      get: (_, prop: keyof LocalStoreState, receiver) => {
        const value = Reflect.get(this.read(), prop, receiver);
        if (typeof value === "object" && value !== null) {
          return this.createDeepProxy(value);
        }
        return value;
      },
      set: (_, props, value, receiver) => {
        const ok = Reflect.set(this.read(), props, value, receiver);
        this.syncDebounce();
        return ok;
      },
      ownKeys: () => {
        return Reflect.ownKeys(this.read());
      },
      deleteProperty: () => {
        throw Errs.LocalDelErr.create();
      },
      getOwnPropertyDescriptor: (_, prop) => {
        return Reflect.getOwnPropertyDescriptor(this.read(), prop);
      }
    });
  }

  public snapshot() {
    return this.read();
  }

  public default(): LocalStoreState {
    return {
      User: {
        LastRefreshCookiesDay: null,
        UserProfile: null,
        UserLoginMode: null,
        UserLikedTrackIDs: { ids: {}, checkPoint: 0 },
        UserLikedPlaylistID: null
      },
      Settings: {
        MusicQuality: TrackQuality.h,
        MaxHistoryListLength: 500
      },
      version: this.version
    };
  }
}

export const LocalStore = new LocalStoreClass();

export function AddLocalStore(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "localSnapshot", {
      get() {
        return LocalStore.snapshot();
      }
    });
    Object.defineProperty(this.prototype, "localProxy", {
      get() {
        return LocalStore.proxy();
      }
    });
  });
}

export function useLocalStore<T extends (keyof LocalStoreState)[]>(select: T) {
  const updater = useUpdate();
  const lastState = useRef(LocalStore.snapshot());

  useEffect(() => {
    const listener = () => {
      const newState = LocalStore.snapshot();
      let changed = false;
      for (const key of select) {
        if (lastState.current[key] !== newState[key]) {
          changed = true;
          break;
        }
      }
      if (changed) {
        lastState.current = newState;
        updater();
      }
    };
    return LocalStore.subscribe(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updater]);

  return useMemo(() => {
    const state = LocalStore.snapshot();
    return select.reduce(
      (result, key: T[number]) => {
        result[key] = state[key];
        return result;
      },
      {} as Pick<LocalStoreState, T[number]>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updater.count]);
}

export function useLocalStoreProxy() {
  return useMemo(() => LocalStore.proxy(), []);
}
