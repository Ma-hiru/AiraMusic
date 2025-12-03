import { EqError } from "@mahiru/ui/utils/dev";

export const CacheStoreErr = new EqError({
  message: "cache-store server error, in normal case, it will not happen"
});

export const NCMServerErr = new EqError({
  message: "ncm server error, check network or ncm server status"
});

export const LyricParseErr = new EqError({
  message: "lyric parse error, the lyric format may be not supported"
});
