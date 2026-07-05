import type { AIErrorCode } from "@mahiru/ai";

import type { PlayerAction } from "./message";

type AgentToolIDInput = {
  id: number;
};

type AgentToolPlayerActionInput = {
  action: PlayerAction;
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
      tool: "agent-search";
      conversationID: string;
      input: AgentToolSearchInput;
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
      tool: "agent-tool-album-detail";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolIDInput;
      tool: "agent-tool-track-lyrics";
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
      tool: "agent-tool-playlist-detail";
    }
  | {
      id: string;
      conversationID: string;
      input: { content: string };
      tool: "agent-tool-replace-lyrics";
    }
  | {
      id: string;
      conversationID: string;
      input: AgentToolCommentInput;
      tool: "agent-tool-track-comment";
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
      tool: "agent-tool-change-settings";
      input: AgentToolChangeSettingsInput;
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
      tool: "agent-tool-comment-open";
      input: { id: number; type: "album" | "track" | "playlist" };
    }
  | {
      id: string;
      conversationID: string;
      tool: "agent-tool-source-open";
      input: { id: number; type: "album" | "artist" | "playlist" };
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

export type AgentSettingsContext = {
  schema: string;
  values: JsonValue;
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
