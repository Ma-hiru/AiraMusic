import { EqError } from "@mahiru/ui/public/utils/dev";

export class Errs {
  static readonly CacheStoreErr = new EqError({
    message: "cache-store server error, in normal case, it will not happen"
  });
  static readonly NCMServerErr = new EqError({
    message: "ncm server error, check network or ncm server status"
  });
  static readonly LyricParseErr = new EqError({
    message: "lyric parse error, the lyric format may be not supported"
  });
  static readonly LocalParseErr = new EqError({ message: "failed to parse local store state" });
  static readonly LocalDelErr = new EqError({
    message: "cannot delete properties from LocalStore"
  });
  static readonly LocalSetErr = new EqError({
    message: "cannot set non-object properties in LocalStore"
  });
  static readonly LocalSubscriberErr = new EqError({
    message: "error occurred in LocalStore subscriber"
  });
  static readonly AcquireLockError = new EqError({ message: "lock is already acquired" });
  static readonly TaskRuntimeError = new EqError({ message: "task execution failed" });
  static readonly ToastBeforeInject = new EqError({
    message:
      "before using useToast, make sure that ToastProvider is mounted and injectToast has been called."
  });
  static readonly ModalBeforeInject = new EqError({
    message:
      "before using useModal, make sure that ModalProvider is mounted and injectModal has been called."
  });
  static readonly ContextMenuBeforeInject = new EqError({
    message:
      "before using useContextMenu, make sure that MenuProvider is mounted and injectContextMenu has been called."
  });
  static readonly KeepAliveNoProvider = new EqError({
    message: "KeepAliveCtx must be used within a KeepAliveProvider"
  });
  static readonly FetchedNotImage = new EqError({ message: "fetched resource is not an image" });
}
