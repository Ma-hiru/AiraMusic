import Lyric from "./lyric";
import * as Track from "./track";
import * as MV from "./mv";
import * as Album from "./album";
import * as Comment from "./comment";
import * as Auth from "./auth";
import * as Playlist from "./playlist";
import * as Recommend from "./recommend";
import * as User from "./user";
import * as Wiki from "./wiki";
import * as Search from "./search";
import * as Similar from "./similar";
import { EqErrorRaw } from "@mahiru/log";
import { Errs } from "@mahiru/ui/public/entry/errs";

function addEqError<T extends Record<string, any>>(module: T): T {
  if (module && typeof module === "object") {
    // 使用空对象作为代理目标，因为 ES 模块是只读的
    return new Proxy({} as T, {
      get(_, key) {
        const value = (module as any)[key];
        if (typeof value === "function") {
          return function (...args: any[]) {
            try {
              return value.apply(module, args);
            } catch (err) {
              if (EqErrorRaw.isEqError(err)) {
                throw err;
              } else {
                throw Errs.NCMServerErr.create(String(key), err);
              }
            }
          };
        }
        return value;
      },
      has(_, key) {
        return key in module;
      },
      ownKeys() {
        return Reflect.ownKeys(module);
      },
      getOwnPropertyDescriptor(_, key) {
        return Object.getOwnPropertyDescriptor(module, key);
      }
    });
  } else {
    return module;
  }
}

export const API = {
  Track,
  MV,
  Album,
  Comment,
  Lyric,
  Auth,
  Playlist,
  Recommend,
  User,
  Wiki,
  Search,
  Similar
};

for (const key in API) {
  // @ts-expect-error
  API[key] = addEqError(API[key]);
}
