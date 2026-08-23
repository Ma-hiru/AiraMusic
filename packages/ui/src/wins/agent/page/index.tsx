import { memo, type FC, useMemo, useState, useEffect, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useAgent } from "@/wins/agent/hooks/useAgent";
import { useMediaQuery } from "@/common/hooks/use-media-query";
import Drag from "@/common/components/layout/drag/drag";
import AppToast from "@/common/components/display/toast";
import Marquee from "@/common/components/display/marquee";
import AppMask from "@/common/components/fallback/app-mask";
import Control from "@/common/components/layout/top/control";
import AppModal, { createDialogModal } from "@/common/components/display/modal";
import type { ProviderConfigView } from "@mahiru/agent/browser";

import Chat from "./chat";
import SideBtn from "./side-btn";
import Background from "./background";
import ConversationList from "./list";
import { createAgentConfigModal } from "./config-modal";

const AgentPage: FC<object> = () => {
  const {
    openConversation,
    setSelectedConfigID,
    loaded,
    configs,
    loading,
    providers,
    saveConfig,
    activeConfig,
    conversation,
    requestClose,
    runningRunID,
    conversations,
    refreshConfigs,
    selectedConfigID,
    createConversation,
    removeConversation,
    refreshConversations,
    runningConversationIDs,
    selectedConversationID
  } = useAgent();

  const { create } = AppModal.useModal();
  const compactLayout = useMediaQuery("(max-width: 1179px)");
  const [openList, setOpenList] = useState(() => !window.matchMedia("(max-width: 1179px)").matches);
  const currentTitle = useMemo(() => {
    return (
      conversation?.name ||
      conversations.find((item) => item.id === selectedConversationID)?.name ||
      "新对话"
    );
  }, [conversation?.name, conversations, selectedConversationID]);
  const statusText = useMemo(() => {
    if (runningRunID) return "运行中";
    if (loading) return "加载中";
    if (activeConfig) return "就绪";
    return "待配置";
  }, [activeConfig, loading, runningRunID]);

  const openConfigModal = useCallback(
    (initialConfig?: ProviderConfigView) => {
      create(createAgentConfigModal, {
        providers,
        defaultProvider: initialConfig?.provider ?? providers[0]?.id,
        initialConfig,
        onSaved: (config) => saveConfig(config, !initialConfig)
      });
    },
    [create, providers, saveConfig]
  );
  const openCreateConfigModal = useCallback(() => openConfigModal(), [openConfigModal]);

  useEffect(() => {
    RendererWindow.current.title(`${currentTitle} - AiraMusic Agent`);
  }, [currentTitle]);

  useEffect(() => {
    setOpenList(!compactLayout);
  }, [compactLayout]);

  const selectConversation = useCallback(
    (id: string) => {
      void openConversation(id);
      if (compactLayout) setOpenList(false);
    },
    [compactLayout, openConversation]
  );

  const confirmRemoveConversation = useCallback(
    (id: string) => {
      const target = conversations.find((item) => item.id === id);
      create(createDialogModal, {
        title: "删除对话",
        body: `确定删除「${target?.name || "未命名会话"}」吗？对话记录删除后无法恢复。`,
        footer: null,
        important: true,
        confirmText: "删除",
        onConfirm: () => void removeConversation(id)
      });
    },
    [conversations, create, removeConversation]
  );

  return (
    <div className="agent-shell relative h-screen w-screen overflow-hidden text-white">
      <AppMask className="z-60 bg-white text-black" show={!loaded} />
      <Drag className="absolute top-0 right-0 z-50 grid h-11 w-screen grid-cols-[1fr_2fr_1fr] items-center px-4">
        <SideBtn openList={openList} statusText={statusText} setOpenList={setOpenList} />
        <Marquee
          className="flex flex-1 items-center justify-center text-center text-[12px] font-medium text-white/82"
          text={currentTitle}
        />
        <div className="flex shrink-0 items-center justify-end gap-3">
          <Control className="justify-end" onClose={requestClose} pin mini />
        </div>
      </Drag>
      <Background />
      <main className="relative top-11 flex h-[calc(100%-44px)] min-h-0 w-screen flex-row px-2 pb-2.5 sm:px-2.5 sm:pb-2.5">
        {compactLayout && openList && (
          <button
            className="absolute inset-0 z-20 cursor-default bg-black/16"
            type="button"
            aria-label="关闭对话列表"
            onClick={() => setOpenList(false)}
          />
        )}
        <ConversationList
          open={openList}
          loading={loading}
          overlay={compactLayout}
          conversations={conversations}
          runningConversationIDs={runningConversationIDs}
          selectedConversationID={selectedConversationID}
          onRefresh={refreshConversations}
          onOpenConversation={selectConversation}
          onCreateConversation={createConversation}
          onRemoveConversation={confirmRemoveConversation}
        />
        <Chat
          className="min-w-0 flex-1"
          configs={configs}
          loadingConfigs={loading}
          activeConfig={activeConfig}
          selectedConfigID={selectedConfigID}
          conversationID={selectedConversationID}
          onEditConfig={openConfigModal}
          onRefreshConfigs={refreshConfigs}
          onSelectConfig={setSelectedConfigID}
          onCreateConfig={openCreateConfigModal}
          onCreateConversation={createConversation}
        />
      </main>
      <AppModal.Provider className="z-60" />
      <AppToast.Provider className="top-12 z-70" />
    </div>
  );
};

export default memo(AgentPage);
