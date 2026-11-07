import { Provider, createStore } from "jotai";
import { act, cleanup, renderHook } from "@testing-library/react";
import { RendererAgentChat } from "@mahiru/ui/wins/agent/lib/chat";
import { useConversation } from "@mahiru/ui/wins/agent/hooks/use-conversation";
import {
  agentSelectedConfigIDAtom,
  agentSelectedConversationIDAtom
} from "@mahiru/ui/wins/agent/atoms/agent";
import type { PropsWithChildren } from "react";
import type { ThreadSnapshot } from "@mahiru/agent/browser";

const mocks = vi.hoisted(() => ({
  createRun: vi.fn(),
  cancelRun: vi.fn(),
  getThread: vi.fn()
}));

vi.mock("@mahiru/ui/wins/agent/lib/agent", () => ({ RendererAgent: mocks }));
vi.mock("@/common/components/display/toast", () => ({ default: { show: vi.fn() } }));
vi.mock("@/common/lib/key-value", () => ({
  RendererKeyValue: class {
    setItem() {
      return Promise.resolve(true);
    }
    removeItem() {
      return Promise.resolve(true);
    }
  }
}));

const entries: RendererAgentChat[] = [];
const snapshot = (id = "thread-1"): ThreadSnapshot => ({
  id,
  name: "测试会话",
  createdAt: 1,
  updatedAt: 2,
  runtime: { status: "idle" },
  messages: [
    { role: "user", content: "已有问题" },
    { role: "assistant", content: "已有回复" }
  ]
});
const getEntry = (store: ReturnType<typeof createStore>, id = "thread-1") => {
  const entry = RendererAgentChat.get(store, id);
  entries.push(entry);
  return entry;
};
const mountConversation = (store: ReturnType<typeof createStore>, strict = false) => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(({ id }) => useConversation(id), {
    initialProps: { id: "thread-1" },
    wrapper,
    reactStrictMode: strict
  });
};
const finish = (entry: RendererAgentChat) =>
  entry.push({
    type: "RUN_FINISHED",
    threadId: entry.conversationID,
    runId: "run-1",
    result: "success",
    usages: { requests: 1, last_step: 1, records: [] }
  });

beforeEach(() => {
  mocks.createRun.mockReset().mockResolvedValue({
    ok: true,
    data: { threadId: "thread-1", runId: "run-1" }
  });
  mocks.cancelRun.mockReset().mockResolvedValue({ ok: true, data: undefined });
  mocks.getThread.mockReset().mockResolvedValue({ ok: true, data: snapshot() });
});

afterEach(async () => {
  cleanup();
  await Promise.all(entries.splice(0).map((entry) => entry.chat.dispose()));
  vi.restoreAllMocks();
});

it.each([true, false])(
  "StrictMode 保留可用实例，selected atom 与 prop 对齐=%s",
  async (aligned) => {
    const store = createStore();
    store.set(agentSelectedConversationIDAtom, aligned ? "thread-1" : "");
    store.set(agentSelectedConfigIDAtom, "config-1");
    const entry = getEntry(store);
    const dispose = vi.spyOn(entry.chat, "dispose");
    const view = mountConversation(store, true);
    await act(async () => Promise.resolve());
    expect(RendererAgentChat.get(store, "thread-1")).toBe(entry);
    expect(dispose).not.toHaveBeenCalled();
    await act(async () => {
      expect(await view.result.current.submit("StrictMode 后发送")).toBe(true);
    });
    expect(mocks.createRun).toHaveBeenCalledExactlyOnceWith({
      content: "StrictMode 后发送",
      configId: "config-1",
      threadId: "thread-1"
    });
  }
);

it("切离空闲会话释放 SDK，重开时从保留快照还原历史", async () => {
  const store = createStore();
  store.set(agentSelectedConversationIDAtom, "thread-1");
  const entry = getEntry(store);
  await entry.restore(snapshot());
  const dispose = vi.spyOn(entry.chat, "dispose");
  const view = mountConversation(store);
  await act(async () => {
    store.set(agentSelectedConversationIDAtom, "thread-2");
    view.rerender({ id: "thread-2" });
  });
  expect(dispose).toHaveBeenCalledOnce();
  const reopened = getEntry(store);
  expect(reopened).not.toBe(entry);
  expect(JSON.stringify(reopened.chat.messages)).toContain("已有回复");
  expect(mocks.cancelRun).not.toHaveBeenCalled();
});

it("切离运行会话保留流消费，收到终态后再释放", async () => {
  const store = createStore();
  store.set(agentSelectedConversationIDAtom, "thread-1");
  const entry = getEntry(store);
  const view = mountConversation(store);
  await act(async () => {
    expect(await entry.submit("后台任务", "config-1")).toBe(true);
  });
  const dispose = vi.spyOn(entry.chat, "dispose");
  await act(async () => {
    store.set(agentSelectedConversationIDAtom, "thread-2");
    view.rerender({ id: "thread-2" });
  });
  expect(dispose).not.toHaveBeenCalled();
  expect(RendererAgentChat.get(store, "thread-1")).toBe(entry);
  await act(async () => {
    await finish(entry);
  });
  expect(dispose).toHaveBeenCalledOnce();
  expect(getEntry(store)).not.toBe(entry);
  expect(mocks.cancelRun).not.toHaveBeenCalled();
});

it("重新查看运行会话取消待释放标记", async () => {
  const store = createStore();
  store.set(agentSelectedConversationIDAtom, "thread-1");
  const entry = getEntry(store);
  const view = mountConversation(store);
  await act(async () => {
    await entry.submit("后台任务", "config-1");
    store.set(agentSelectedConversationIDAtom, "thread-2");
    view.rerender({ id: "thread-2" });
  });
  const dispose = vi.spyOn(entry.chat, "dispose");
  await act(async () => {
    store.set(agentSelectedConversationIDAtom, "thread-1");
    view.rerender({ id: "thread-1" });
  });
  await act(async () => {
    await finish(entry);
  });
  expect(dispose).not.toHaveBeenCalled();
  expect(RendererAgentChat.get(store, "thread-1")).toBe(entry);
});

it("切离正在提交的会话等拒绝响应处理完成后再释放", async () => {
  const store = createStore();
  store.set(agentSelectedConversationIDAtom, "thread-1");
  const entry = getEntry(store);
  const view = mountConversation(store);
  const accepted = Promise.withResolvers<{
    ok: false;
    reason: { code: string; message: string };
  }>();
  mocks.createRun.mockReturnValueOnce(accepted.promise);
  const dispose = vi.spyOn(entry.chat, "dispose");
  let submitting: Promise<boolean>;
  await act(async () => {
    submitting = entry.submit("等待响应", "config-1");
    store.set(agentSelectedConversationIDAtom, "thread-2");
    view.rerender({ id: "thread-2" });
  });
  expect(dispose).not.toHaveBeenCalled();
  await act(async () => {
    accepted.resolve({ ok: false, reason: { code: "run_rejected", message: "配置不可用" } });
    expect(await submitting!).toBe(false);
  });
  expect(dispose).toHaveBeenCalledOnce();
  expect(mocks.cancelRun).not.toHaveBeenCalled();
});
