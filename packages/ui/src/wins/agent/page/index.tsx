import { memo, type FC, useMemo, useState, useEffect, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useAgent } from "@/wins/agent/hooks/useAgent";
import Drag from "@/common/components/layout/drag/drag";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import Marquee from "@/common/components/display/marquee";
import AppMask from "@/common/components/fallback/app-mask";
import Control from "@/common/components/layout/top/control";

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
    activeConfig,
    conversation,
    createConfig,
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
  const [openList, setOpenList] = useState(true);
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

  const openConfigModal = useCallback(async () => {
    create(createAgentConfigModal, {
      providers,
      defaultProvider: providers[0],
      onCreated: createConfig
    });
  }, [create, createConfig, providers]);

  useEffect(() => {
    RendererWindow.current.title(`${currentTitle} - AiraMusic Agent`);
  }, [currentTitle]);

  return (
    <div className="relative h-screen w-screen overflow-hidden text-white">
      <AppMask className="z-60 bg-white text-black" show={!loaded} />
      <Drag className="absolute top-0 right-0 z-50 grid h-11 w-screen grid-cols-[1fr_2fr_1fr] items-center px-4">
        <SideBtn openList={openList} statusText={statusText} setOpenList={setOpenList} />
        <Marquee
          className="flex flex-1 items-center justify-center text-center text-[13px] font-semibold"
          text={currentTitle}
        />
        <div className="flex shrink-0 items-center justify-end gap-3">
          <Control className="justify-end" onClose={requestClose} pin mini />
        </div>
      </Drag>
      <Background />
      <main className="relative top-11 flex h-[calc(100%-44px)] min-h-0 w-screen flex-row px-3 pb-3">
        <ConversationList
          open={openList}
          loading={loading}
          conversations={conversations}
          runningConversationIDs={runningConversationIDs}
          selectedConversationID={selectedConversationID}
          onRefresh={refreshConversations}
          onOpenConversation={openConversation}
          onCreateConversation={createConversation}
          onRemoveConversation={removeConversation}
        />
        <Chat
          className="min-w-0 flex-1"
          configs={configs}
          loadingConfigs={loading}
          activeConfig={activeConfig}
          selectedConfigID={selectedConfigID}
          conversationID={selectedConversationID}
          onCreateConfig={openConfigModal}
          onRefreshConfigs={refreshConfigs}
          onSelectConfig={setSelectedConfigID}
          onCreateConversation={createConversation}
        />
      </main>
      <AppModal.Provider className="z-60" />
      <AppToast.Provider className="top-12 z-70" />
    </div>
  );
};

export default memo(AgentPage);
