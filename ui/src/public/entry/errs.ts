import { EqError } from "@mahiru/ui/public/utils/dev";

export const Errs = {
  CacheStoreErr: new EqError({
    message: "cache-store server error, in normal case, it will not happen"
  }),
  NCMServerErr: new EqError({ message: "ncm server error, check network or ncm server status" }),
  LyricParseErr: new EqError({
    message: "lyric parse error, the lyric format may be not supported"
  }),
  LocalParseErr: new EqError({ message: "failed to parse local store state" }),
  LocalDelErr: new EqError({ message: "cannot delete properties from LocalStore" }),
  LocalSetErr: new EqError({
    message: "cannot set non-object properties in LocalStore"
  }),
  LocalSubscriberErr: new EqError({
    message: "error occurred in LocalStore subscriber"
  }),
  AcquireLockError: new EqError({ message: "lock is already acquired" }),
  TaskRuntimeError: new EqError({ message: "task execution failed" })
};
