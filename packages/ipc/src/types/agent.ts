import type { AIErrorCode } from "@mahiru/ai";

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

export type AgentToolRequest =
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-lyric-schema";
    }
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-tool-track-fm";
    }
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-tool-user-info";
    }
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-tool-search-hot";
    }
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-tool-player-queue";
    }
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-tool-settings-get";
    }
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-tool-home-toplists";
    }
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-tool-player-current";
    }
  | {
      id: string;
      tool: "agent-search";
      conversationID: string;
      input: AgentToolSearchInput;
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-fm-trash";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-track-play";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-artist-desc";
    }
  | {
      id: string;
      input: object;
      conversationID: string;
      tool: "agent-tool-track-recommend-daily";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-album-detail";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-artist-detail";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-track-similar";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-artist-similar";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-track-playable";
    }
  | {
      id: string;
      conversationID: string;
      input: { keyword: string };
      tool: "agent-tool-search-open";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-playlist-delete";
    }
  // ---- 播放器信息与控制 ----
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-playlist-detail";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-playlist-similar";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolLyricsInput;
      tool: "agent-tool-track-lyrics";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-artist-hot-tracks";
    }
  // ---- 用户 ----
  | {
      id: string;
      conversationID: string;
      input: { content: string };
      tool: "agent-tool-replace-lyrics";
    }
  | {
      id: string;
      conversationID: string;
      input: { keyword: string };
      tool: "agent-tool-search-suggest";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolCommentInput;
      tool: "agent-tool-track-comment";
    }
  // ---- 歌曲操作 ----
  | {
      id: string;
      conversationID: string;
      input: { limit?: number };
      tool: "agent-tool-playlist-recommend";
    }
  | {
      id: string;
      conversationID: string;
      input: { type?: 1 | 2 | 3 | 4 };
      tool: "agent-tool-artist-toplist";
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-player-action";
      input: AgentToolPlayerActionInput;
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-track-like";
      input: { id: number; like: boolean };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-player-seek";
      input: { position: number | string };
    }
  // ---- 艺人 ----
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-change-settings";
      input: AgentToolChangeSettingsInput;
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-album-star";
      input: { id: number; subscribe: boolean };
    }
  | {
      id: string;
      conversationID: string;
      input: { type: 0 | 1; uid: number };
      tool: "agent-tool-user-play-history";
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-playlist-create";
      input: { name: string; privacy?: 10 };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-playlist-star";
      input: { id: number; subscribe: boolean };
    }
  // ---- 歌单管理 ----
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-player-volume";
      input: { mute?: boolean; volume?: number };
    }
  | {
      id: string;
      conversationID: string;
      input: { type?: 0 | 7 | 8 | 16 | 96 };
      tool: "agent-tool-track-recommend-new";
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-record";
      input: { type: "week" | "month" | "today" | "total" };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-track-detail";
      input: { ids: number[]; mode: "detail" | "simple" };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-artist-albums";
      input: { id: number; page?: number; pageSize?: number };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-user-playlists";
      input: { uid?: number; limit?: number; offset?: number };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-comment-open";
      input: { id: number; type: "album" | "track" | "playlist" };
    }
  // ---- 专辑 ----
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-source-open";
      input: { id: number; type: "album" | "artist" | "playlist" };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-playlist-modify";
      input: { pid: number; op: "add" | "del"; trackIds: number[] };
    }
  // ---- 评论互动 ----
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-player-queue-remove";
      input: { scope: "all" } | { ids: number[]; scope: "tracks" };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-player-queue-add";
      input: {
        ids: number[];
        position: "end" | "next";
      };
    }
  // ---- 搜索增强 ----
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-playlist-top";
      input: { cat?: string; limit?: number; offset?: number; order?: "hot" | "new" };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-album-new";
      input: { limit?: number; offset?: number; area?: "EA" | "JP" | "KR" | "ZH" | "ALL" };
    }
  // ---- 首页与榜单 ----
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-player-mode";
      input: {
        shuffle?: boolean;
        repeat?: "all" | "off" | "one";
      };
    }
  // ---- 设置 ----
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-comment-like";
      input: { id: number; cid: number; like: boolean; type: "album" | "track" | "playlist" };
    }
  // ---- 听歌统计 ----
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-comment-send";
      input: {
        id: number;
        content: string;
        commentId?: number;
        type: "album" | "track" | "playlist";
      };
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
  message: string;
  type: AIErrorCode;
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

export type AgentConversationSummary = {
  id: string;
  name: string;
};
