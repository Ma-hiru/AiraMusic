<template>
  <div class="w-screen h-screen overflow-hidden bg-white rounded-md">
    <div class="px-1 py-2 w-40" ref="containerRef">
      <TrayPlayer
        v-if="Boolean(playerBus.data?.track?.detail)"
        :track="playerBus.data?.track?.detail!" />
      <TrayDivider v-if="Boolean(playerBus.data?.track?.detail)" />
      <TrayItem v-for="item in items" :icon="item.icon" :text="item.text" @click="item.click" />
    </div>
  </div>
</template>

<script setup lang="ts" name="Tray">
  import TrayItem from "@mahiru/ui/windows/tray/page/TrayItem.vue";
  import TrayPlayer from "@mahiru/ui/windows/tray/page/TrayPlayer.vue";
  import TrayDivider from "@mahiru/ui/windows/tray/page/TrayDivider.vue";
  import ElectronServices from "@mahiru/ui/public/source/electron/services";
  import useListenableHookVue from "@mahiru/ui/public/hooks/useListenableHookVue";
  import { computed, onMounted, onUnmounted, useTemplateRef, watch } from "vue";
  import {
    Copy,
    DiscAlbum,
    LogOut,
    MessageSquare,
    MicVocal,
    Pause,
    Play,
    SkipBack,
    SkipForward
  } from "lucide-vue-next";
  import { useThemeInjectFromBusVue } from "@mahiru/ui/public/hooks/useThemeInjectFromBusVue";

  const containerRef = useTemplateRef<HTMLDivElement>("containerRef");
  const playerBus = useListenableHookVue(ElectronServices.Bus.player);
  const currentWindow = useListenableHookVue(ElectronServices.Window.current);
  // 主题
  useThemeInjectFromBusVue();
  // Actions
  function copy(text: Optional<string>) {
    if (!text) return;
    window.navigator.clipboard.writeText(text);
  }
  // Icons & Actions
  const items = computed(() => {
    const result = [
      {
        icon: SkipBack,
        text: "上一首",
        click: () => ElectronServices.Bus.playerAction.send("previous")
      },
      {
        icon: SkipForward,
        text: "下一首",
        click: () => ElectronServices.Bus.playerAction.send("next")
      },
      { icon: MicVocal, text: "歌手", click: () => {} },
      { icon: DiscAlbum, text: "专辑", click: () => {} },
      {
        icon: MessageSquare,
        text: "评论",
        click: async () => {
          const id = playerBus.value.data?.track?.id;
          if (!id) return;
          await ElectronServices.Window.from("comments").openAwait();
          ElectronServices.Bus.comment.send({
            id,
            type: "track"
          });
        }
      },
      {
        icon: Copy,
        text: "复制歌名",
        click: () => copy(playerBus.value.data?.track?.name)
      },
      {
        icon: Copy,
        text: "复制歌手名",
        click: () => copy(playerBus.value.data?.track?.detail?.ar.map((a) => a.name).join(" / "))
      },
      {
        icon: Copy,
        text: "复制专辑名",
        click: () => copy(playerBus.value.data?.track?.detail?.al.name)
      },
      {
        icon: LogOut,
        text: "退出",
        click: () => ElectronServices.Bus.playerAction.send("exit")
      }
    ];
    if (playerBus.value.data?.status === "playing") {
      result.unshift({
        icon: Pause,
        text: "暂停",
        click: () => ElectronServices.Bus.playerAction.send("pause")
      });
    } else {
      result.unshift({
        icon: Play,
        text: "播放",
        click: () => ElectronServices.Bus.playerAction.send("play")
      });
    }
    return result;
  });
  // 修改窗口标题
  watch(playerBus, (playerBus) => {
    const name = playerBus.data?.track?.name;
    const artist = playerBus.data?.track?.detail.ar.map((a) => a.name).join(" / ");
    if (name && artist) {
      document.title = `${name} - ${artist}`;
    }
  });
  // 动态调整窗口大小
  let observer: ResizeObserver;
  onMounted(() => {
    observer = new ResizeObserver(() => {
      const deltaX = window.innerWidth - (containerRef.value?.offsetWidth || window.innerWidth);
      const deltaY = window.innerHeight - (containerRef.value?.offsetHeight || window.innerHeight);
      currentWindow.value.resize({
        width: containerRef.value?.offsetWidth || window.innerWidth,
        height: containerRef.value?.offsetHeight || window.innerHeight
      });
      currentWindow.value.move({
        x: window.screenX + deltaX,
        y: window.screenY + deltaY
      });
    });
    containerRef.value && observer.observe(containerRef.value);
  });
  onUnmounted(() => {
    observer.disconnect();
  });
</script>

<style scoped lang="scss"></style>
