import type { PlayerAction } from "./message";

type AgentToolIDInput = {
  id: number;
};

type AgentToolLyricsInput = AgentToolIDInput & {
  mode: "editable" | "semantic";
};

type AgentToolPlayerActionInput = {
  action: Exclude<PlayerAction, "exit" | "update">;
};

type AgentToolCommentInput = {
  id: number;
  page: number;
  pageSize: number;
  sort: "hot" | "new" | "recommend";
  type: "album" | "track" | "playlist";
};

type AgentToolSearchInput = {
  page: number;
  keyword: string;
  pageSize: number;
  type: "album" | "track" | "artist" | "playlist";
};

type AgentToolChangeSettingsInput = {
  key: string;
  value: JsonValue;
};

type AgentToolInputs = {
  "agent-lyric-schema": object;
  "agent-tool-track-fm": object;
  "agent-tool-user-info": object;
  "agent-tool-search-hot": object;
  "agent-tool-player-queue": object;
  "agent-tool-settings-get": object;
  "agent-tool-home-toplists": object;
  "agent-tool-player-current": object;
  "agent-search": AgentToolSearchInput;
  "agent-tool-fm-trash": AgentToolIDInput;
  "agent-tool-track-play": AgentToolIDInput;
  "agent-tool-artist-desc": AgentToolIDInput;
  "agent-tool-track-recommend-daily": object;
  "agent-tool-album-detail": AgentToolIDInput;
  "agent-tool-artist-detail": AgentToolIDInput;
  "agent-tool-track-similar": AgentToolIDInput;
  "agent-tool-artist-similar": AgentToolIDInput;
  "agent-tool-search-open": { keyword: string };
  "agent-tool-track-playable": AgentToolIDInput;
  "agent-tool-playlist-delete": AgentToolIDInput;
  "agent-tool-playlist-detail": AgentToolIDInput;
  "agent-tool-playlist-similar": AgentToolIDInput;
  "agent-tool-track-lyrics": AgentToolLyricsInput;
  "agent-tool-artist-hot-tracks": AgentToolIDInput;
  "agent-tool-replace-lyrics": { content: string };
  "agent-tool-search-suggest": { keyword: string };
  "agent-tool-track-comment": AgentToolCommentInput;
  "agent-tool-playlist-recommend": { limit?: number };
  "agent-tool-artist-toplist": { type?: 1 | 2 | 3 | 4 };
  "agent-tool-player-action": AgentToolPlayerActionInput;
  "agent-tool-track-like": { id: number; like: boolean };
  "agent-tool-player-seek": { position: number | string };
  "agent-tool-change-settings": AgentToolChangeSettingsInput;
  "agent-tool-album-star": { id: number; subscribe: boolean };
  "agent-tool-playlist-create": { name: string; privacy?: 10 };
  "agent-tool-user-play-history": { type: 0 | 1; uid: number };
  "agent-tool-playlist-star": { id: number; subscribe: boolean };
  "agent-tool-player-volume": { mute?: boolean; volume?: number };
  "agent-tool-track-recommend-new": { type?: 0 | 7 | 8 | 16 | 96 };
  "agent-tool-record": { type: "week" | "month" | "today" | "total" };
  "agent-tool-track-detail": { ids: number[]; mode: "detail" | "simple" };
  "agent-tool-artist-albums": { id: number; page?: number; pageSize?: number };
  "agent-tool-user-playlists": { uid?: number; limit?: number; offset?: number };
  "agent-tool-comment-open": { id: number; type: "album" | "track" | "playlist" };
  "agent-tool-source-open": { id: number; type: "album" | "artist" | "playlist" };
  "agent-tool-playlist-modify": { pid: number; op: "add" | "del"; trackIds: number[] };
  "agent-tool-player-queue-add": {
    ids: number[];
    position: "end" | "next";
  };
  "agent-tool-player-queue-remove": { scope: "all" } | { ids: number[]; scope: "tracks" };
  "agent-tool-player-mode": {
    shuffle?: boolean;
    repeat?: "all" | "off" | "one";
  };
  "agent-tool-album-new": {
    limit?: number;
    offset?: number;
    area?: "EA" | "JP" | "KR" | "ZH" | "ALL";
  };
  "agent-tool-playlist-top": {
    cat?: string;
    limit?: number;
    offset?: number;
    order?: "hot" | "new";
  };
  "agent-tool-comment-like": {
    id: number;
    cid: number;
    like: boolean;
    type: "album" | "track" | "playlist";
  };
  "agent-tool-comment-send": {
    id: number;
    content: string;
    commentId?: number;
    type: "album" | "track" | "playlist";
  };
};

export type AgentToolRequest = {
  [Tool in keyof AgentToolInputs]: { tool: Tool; input: AgentToolInputs[Tool] };
}[keyof AgentToolInputs] & {
  id: string;
  conversationID: string;
  /** 由模型选择，渲染进程仍施加裁剪与脱敏上限。 */
  detail?: "compact" | "detailed" | "standard";
};

export type AgentToolResponse =
  | {
      ok: false;
      id: string;
      reason: string;
    }
  | {
      ok: true;
      id: string;
      data: JsonValue;
    };

export type AgentToolCancel = {
  id: string;
  reason: "aborted" | "timeout";
};

export type AgentFocusContext =
  | {
      page: "home" | "hidden" | "settings";
    }
  | {
      page: "search";
      keyword: string;
    }
  | {
      id: number;
      name: string;
      page: "album" | "artist";
    }
  | {
      page: "playlist";
      id: Nullable<number>;
      source: "normal" | "user-liked-track";
    }
  | {
      page: "history";
      recent: { id: number; name: string; time: string; playDuration: string }[];
    };

export type AgentInvokeError = {
  code: string;
  message: string;
};

export type AgentInvokeResult<T> =
  | {
      data: T;
      ok: true;
    }
  | {
      ok: false;
      reason: AgentInvokeError;
    };
