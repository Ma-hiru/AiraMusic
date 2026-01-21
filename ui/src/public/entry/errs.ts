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
  TaskRuntimeError: new EqError({ message: "task execution failed" }),
  ToastBeforeInject: new EqError({
    message:
      "before using useToast, make sure that ToastProvider is mounted and injectToast has been called."
  }),
  ModalBeforeInject: new EqError({
    message:
      "before using useModal, make sure that ModalProvider is mounted and injectModal has been called."
  }),
  ContextMenuBeforeInject: new EqError({
    message:
      "before using useContextMenu, make sure that MenuProvider is mounted and injectContextMenu has been called."
  }),
  KeepAliveNoProvider: new EqError({
    message: "KeepAliveCtx must be used within a KeepAliveProvider"
  }),
  FetchedNotImage: new EqError({ message: "fetched resource is not an image" })
};
