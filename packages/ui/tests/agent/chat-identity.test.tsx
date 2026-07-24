import { vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Chat from "@mahiru/ui/wins/agent/page/chat";
import type { ReactNode } from "react";

vi.mock("@/wins/agent/hooks/use-conversation", () => ({
  useConversation: () => ({
    abort: vi.fn(),
    retry: vi.fn(),
    submit: vi.fn(),
    sending: false,
    recovering: false,
    streamText: "",
    conversation: null,
    liveTimeline: [],
    runningRunID: "",
    retryCandidate: null,
    pendingUserMessage: ""
  })
}));

vi.mock("@/common/components/layout/card", () => ({
  default: ({ children }: { children: ReactNode }) => <section>{children}</section>
}));

vi.mock("@mahiru/ui/wins/agent/page/chat/content", () => ({
  default: () => <main data-testid="chat-content" />
}));

vi.mock("@mahiru/ui/wins/agent/page/chat/input", () => ({
  default: () => <footer data-testid="chat-input" />
}));

vi.mock("@mahiru/ui/wins/agent/page/chat/config-picker", () => ({
  default: () => <div data-testid="config-picker" />
}));

vi.mock("@mahiru/ui/wins/agent/page/chat/tool-presentation", () => ({
  getAgentToolPresentation: () => ({ label: "工具" })
}));

afterEach(() => {
  cleanup();
});

const renderChat = (conversationID: string) => (
  <Chat
    configs={[]}
    selectedConfigID=""
    activeConfig={undefined}
    conversationID={conversationID}
    onEditConfig={vi.fn()}
    onCreateConfig={vi.fn()}
    onSelectConfig={vi.fn()}
    onRefreshConfigs={vi.fn()}
    onCreateConversation={vi.fn()}
  />
);

describe("Agent 对话结构身份", () => {
  it.each(["", "bd370066-3ae5-48a4-901e-46eefda2eb41"])(
    "会话 ID 为 %j 时不会产生重复 key",
    (conversationID) => {
      const errors: string[] = [];
      const consoleError = vi.spyOn(console, "error").mockImplementation((...args) => {
        errors.push(args.map(String).join(" "));
      });

      try {
        render(renderChat(conversationID));

        expect(errors.filter((message) => /same key|unique key/i.test(message))).toHaveLength(0);
      } finally {
        consoleError.mockRestore();
      }
    }
  );

  it("反复切换会话时不会泄漏旧的内容区或输入区", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const view = render(renderChat(""));
      for (const conversationID of ["conversation-a", "conversation-b", "conversation-a"]) {
        view.rerender(renderChat(conversationID));
      }

      expect(view.getAllByTestId("chat-content")).toHaveLength(1);
      expect(view.getAllByTestId("chat-input")).toHaveLength(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});
