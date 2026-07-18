import { atom } from "jotai";
import { selectAtom, atomWithStorage } from "jotai/utils";
import { RendererKeyValue } from "@/common/lib/key-value";
import type { SyncStorage } from "jotai/vanilla/utils/atomWithStorage";
import type { LLMConversationSnapshot } from "@mahiru/ai";
import type { AgentLiveTimelineItem } from "@/wins/agent/page/types";

export interface AgentConversationState {
  sending: boolean;
  streamText: string;
  recovering: boolean;
  runningRunID: string;
  pendingUserMessage: string;
  liveTimeline: AgentLiveTimelineItem[];
  conversation: Nullable<LLMConversationSnapshot>;
}

export interface AgentConversationResumeState {
  recovering: boolean;
  runningRunID: string;
  conversationID: string;
  pendingUserMessage: string;
}

export type AgentConversationStates = Record<string, AgentConversationState>;

export type AgentConversationResumeStates = Record<string, AgentConversationResumeState>;

export interface AgentStorageSnapshot {
  selectedConfigID: string;
  selectedConversationID: string;
  conversationResumeStates: AgentConversationResumeStates;
}

export const EMPTY_LIVE_TIMELINE: AgentLiveTimelineItem[] = [];
export const AGENT_PENDING_MESSAGE_STORAGE_LIMIT = 2_000;

export const createAgentConversationState = (): AgentConversationState => ({
  sending: false,
  recovering: false,
  streamText: "",
  runningRunID: "",
  liveTimeline: EMPTY_LIVE_TIMELINE,
  conversation: null,
  pendingUserMessage: ""
});

export const EMPTY_AGENT_CONVERSATION_STATE = createAgentConversationState();

const toResumeState = (
  conversationID: string,
  state: AgentConversationState
): AgentConversationResumeState => ({
  conversationID,
  recovering: state.recovering,
  runningRunID: state.runningRunID,
  pendingUserMessage: state.pendingUserMessage.slice(0, AGENT_PENDING_MESSAGE_STORAGE_LIMIT)
});

const fromResumeState = (state: AgentConversationResumeState): AgentConversationState => ({
  ...createAgentConversationState(),
  recovering: state.recovering || !!state.runningRunID || !!state.pendingUserMessage,
  runningRunID: state.runningRunID,
  pendingUserMessage: state.pendingUserMessage
});

const resumeStateEqual = (
  a: Optional<AgentConversationResumeState>,
  b: AgentConversationResumeState
) => {
  return (
    !!a &&
    a.conversationID === b.conversationID &&
    a.recovering === b.recovering &&
    a.runningRunID === b.runningRunID &&
    a.pendingUserMessage === b.pendingUserMessage
  );
};

const stringArrayEqual = (a: string[], b: string[]) => {
  return a.length === b.length && a.every((item, index) => item === b[index]);
};

export const getAgentRecoverableConversationIDs = (states: AgentConversationResumeStates) =>
  Object.entries(states).flatMap(([conversationID, state]) =>
    state.runningRunID || state.recovering || state.pendingUserMessage ? [conversationID] : []
  );

const asStorageRecord = (value: unknown): null | Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const readStorageString = (value: unknown) => (typeof value === "string" ? value : "");

const normalizeResumeStates = (value: unknown): AgentConversationResumeStates => {
  const record = asStorageRecord(value);
  if (!record) return {};

  const states: AgentConversationResumeStates = {};
  for (const [conversationID, rawState] of Object.entries(record)) {
    if (!conversationID) continue;
    const state = asStorageRecord(rawState);
    if (!state) continue;
    const normalized: AgentConversationResumeState = {
      conversationID,
      recovering: state["recovering"] === true,
      runningRunID: readStorageString(state["runningRunID"]),
      pendingUserMessage: readStorageString(state["pendingUserMessage"]).slice(
        0,
        AGENT_PENDING_MESSAGE_STORAGE_LIMIT
      )
    };
    if (!normalized.recovering && !normalized.runningRunID && !normalized.pendingUserMessage) {
      continue;
    }
    states[conversationID] = normalized;
  }
  return states;
};

export const normalizeAgentStorageSnapshot = (value: unknown): AgentStorageSnapshot => {
  const snapshot = asStorageRecord(value);
  return {
    selectedConfigID: readStorageString(snapshot?.["selectedConfigID"]),
    selectedConversationID: readStorageString(snapshot?.["selectedConversationID"]),
    conversationResumeStates: normalizeResumeStates(snapshot?.["conversationResumeStates"])
  };
};

const agentKeyValue = new RendererKeyValue();

const AGENT_SELECTED_CONFIG_ID_KEY = "agent.selectedConfigID";
const AGENT_SELECTED_CONVERSATION_ID_KEY = "agent.selectedConversationID";
const AGENT_CONVERSATION_RESUME_STATES_KEY = "agent.conversationResumeStates";

const agentStorageCache = new Map<string, JsonValue>();

const agentStorage: SyncStorage<JsonValue> = {
  getItem: (key, initialValue) => {
    return agentStorageCache.has(key) ? agentStorageCache.get(key)! : initialValue;
  },
  setItem: (key, value) => {
    agentStorageCache.set(key, value);
    void agentKeyValue.setItem(key, value);
  },
  removeItem: (key) => {
    agentStorageCache.delete(key);
    void agentKeyValue.removeItem(key);
  }
};

const createAgentStorage = <Value>() => agentStorage as unknown as SyncStorage<Value>;

const cacheAgentStorageSnapshot = (snapshot: AgentStorageSnapshot) => {
  agentStorageCache.set(AGENT_SELECTED_CONFIG_ID_KEY, snapshot.selectedConfigID);
  agentStorageCache.set(AGENT_SELECTED_CONVERSATION_ID_KEY, snapshot.selectedConversationID);
  agentStorageCache.set(
    AGENT_CONVERSATION_RESUME_STATES_KEY,
    snapshot.conversationResumeStates as unknown as JsonValue
  );
};

export const loadAgentAtomStorageSnapshot = async (): Promise<AgentStorageSnapshot> => {
  const [selectedConfigID, selectedConversationID, conversationResumeStates] = await Promise.all([
    agentKeyValue.getItem(AGENT_SELECTED_CONFIG_ID_KEY, ""),
    agentKeyValue.getItem(AGENT_SELECTED_CONVERSATION_ID_KEY, ""),
    agentKeyValue.getItem<JsonValue>(AGENT_CONVERSATION_RESUME_STATES_KEY, {})
  ]);
  // 旧版本会把完整会话和工具历史放进 renderer 存储；加载时只迁移恢复所需字段。
  const snapshot = normalizeAgentStorageSnapshot({
    selectedConfigID,
    selectedConversationID,
    conversationResumeStates
  });
  cacheAgentStorageSnapshot(snapshot);
  return snapshot;
};

const fromResumeStates = (resumeStates: AgentConversationResumeStates): AgentConversationStates => {
  return Object.fromEntries(
    Object.entries(resumeStates).map(([conversationID, state]) => [
      conversationID,
      fromResumeState(state)
    ])
  );
};

export const agentSelectedConfigIDAtom = atomWithStorage(
  AGENT_SELECTED_CONFIG_ID_KEY,
  "",
  createAgentStorage(),
  {
    getOnInit: true
  }
);

export const agentSelectedConversationIDAtom = atomWithStorage(
  AGENT_SELECTED_CONVERSATION_ID_KEY,
  "",
  createAgentStorage(),
  {
    getOnInit: true
  }
);

export const agentConversationResumeStatesAtom = atomWithStorage<AgentConversationResumeStates>(
  AGENT_CONVERSATION_RESUME_STATES_KEY,
  {},
  createAgentStorage(),
  {
    getOnInit: true
  }
);

export const agentConversationStatesAtom = atom<AgentConversationStates>({});

export const agentCloseAfterRunningAtom = atom(false);

export const agentApplyStorageSnapshotAtom = atom(
  null,
  (_get, set, snapshot: AgentStorageSnapshot) => {
    const normalized = normalizeAgentStorageSnapshot(snapshot);
    cacheAgentStorageSnapshot(normalized);
    set(agentSelectedConfigIDAtom, normalized.selectedConfigID);
    set(agentSelectedConversationIDAtom, normalized.selectedConversationID);
    set(agentConversationResumeStatesAtom, normalized.conversationResumeStates);
    set(agentConversationStatesAtom, fromResumeStates(normalized.conversationResumeStates));
  }
);

export const agentSelectedConversationAtom = atom((get) => {
  const selectedConversationID = get(agentSelectedConversationIDAtom);
  if (!selectedConversationID) return null;
  return get(agentConversationStatesAtom)[selectedConversationID]?.conversation ?? null;
});

export const agentSelectedConversationRunningRunIDAtom = atom((get) => {
  const selectedConversationID = get(agentSelectedConversationIDAtom);
  if (!selectedConversationID) return "";
  return get(agentConversationStatesAtom)[selectedConversationID]?.runningRunID ?? "";
});

export const agentBusyConversationIDsAtom = selectAtom(
  agentConversationStatesAtom,
  (states) =>
    Object.entries(states).flatMap(([conversationID, state]) =>
      state.runningRunID || state.sending || state.recovering ? [conversationID] : []
    ),
  stringArrayEqual
);

export const agentRecoverableConversationIDsAtom = selectAtom(
  agentConversationResumeStatesAtom,
  getAgentRecoverableConversationIDs,
  stringArrayEqual
);

export const createAgentConversationStateAtom = (conversationID: string) =>
  selectAtom(
    agentConversationStatesAtom,
    (states) => states[conversationID] ?? EMPTY_AGENT_CONVERSATION_STATE,
    Object.is
  );

export const agentUpdateConversationStateAtom = atom(
  null,
  (
    get,
    set,
    {
      update,
      conversationID
    }: {
      conversationID: string;
      update: NormalFunc<[state: AgentConversationState], AgentConversationState>;
    }
  ) => {
    if (!conversationID) return;

    const states = get(agentConversationStatesAtom);
    const current = states[conversationID] ?? createAgentConversationState();
    const next = update(current);
    if (next === current) return;

    set(agentConversationStatesAtom, {
      ...states,
      [conversationID]: next
    });

    const resumeState = toResumeState(conversationID, next);
    const resumeStates = get(agentConversationResumeStatesAtom);
    if (!resumeState.recovering && !resumeState.runningRunID && !resumeState.pendingUserMessage) {
      if (!(conversationID in resumeStates)) return;
      const { [conversationID]: removedResumeState, ...nextResumeStates } = resumeStates;
      void removedResumeState;
      set(agentConversationResumeStatesAtom, nextResumeStates);
      return;
    }
    if (resumeStateEqual(resumeStates[conversationID], resumeState)) return;

    set(agentConversationResumeStatesAtom, {
      ...resumeStates,
      [conversationID]: resumeState
    });
  }
);

export const agentRemoveConversationStateAtom = atom(null, (get, set, conversationID: string) => {
  if (!conversationID) return;

  const states = get(agentConversationStatesAtom);
  const resumeStates = get(agentConversationResumeStatesAtom);
  const { [conversationID]: removedState, ...nextStates } = states;
  const { [conversationID]: removedResumeState, ...nextResumeStates } = resumeStates;
  void removedState;
  void removedResumeState;
  set(agentConversationStatesAtom, nextStates);
  set(agentConversationResumeStatesAtom, nextResumeStates);
});
