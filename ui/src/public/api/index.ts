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
    return new Proxy(module, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (typeof value === "function") {
          return function (...args: any[]) {
            try {
              // @ts-expect-error
              return value.apply(this, args);
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
