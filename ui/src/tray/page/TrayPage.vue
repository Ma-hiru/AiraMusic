<template>
  <div class="w-screen h-screen overflow-hidden bg-white rounded-md">
    <div class="px-1 py-2 w-40" ref="containerRef">
      <TrayPlayer :track="track" />
      <TrayDivider />
      <TrayItem v-for="item in items" :icon="item.icon" :text="item.text" @click="item.click" />
    </div>
  </div>
</template>

<script setup lang="ts" name="Tray">
  import TrayItem from "@mahiru/ui/tray/page/TrayItem.vue";
  import TrayPlayer from "@mahiru/ui/tray/page/TrayPlayer.vue";
  import TrayDivider from "@mahiru/ui/tray/page/TrayDivider.vue";
  import { Renderer } from "@mahiru/ui/public/entry/renderer";
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
  import { computed, onMounted, onUnmounted, toRaw, useTemplateRef, watch } from "vue";
  import { useThemeSyncReceiveVue } from "@mahiru/ui/public/hooks/useThemeSyncReceiveVue";
  import { usePlayerTrackSyncReceiveVue } from "@mahiru/ui/public/hooks/usePlayerTrackSyncReceiveVue";
  import { usePlayerStatusSyncReceiveVue } from "@mahiru/ui/public/hooks/usePlayerStatusSyncReceiveVue";
  import { PlayerFSMStatusEnum } from "@mahiru/ui/public/enum";

  const { themeSync, requestThemeSync } = useThemeSyncReceiveVue();
  const { trackSync, requestPlayerTrackSync } = usePlayerTrackSyncReceiveVue();
  const { playerStatusSync, requestPlayerStatusSync } = usePlayerStatusSyncReceiveVue();

  const containerRef = useTemplateRef<HTMLDivElement>("containerRef");
  const track = computed(() => trackSync.value?.track);
  const items = computed(() => {
    const result = [
      {
        icon: SkipBack,
        text: "上一首",
        click: () => Renderer.sendMessage("playerControl", "main", "last")
      },
      {
        icon: SkipForward,
        text: "下一首",
        click: () => Renderer.sendMessage("playerControl", "main", "next")
      },
      { icon: MicVocal, text: "歌手", click: () => {} },
      { icon: DiscAlbum, text: "专辑", click: () => {} },
      {
        icon: MessageSquare,
        text: "评论",
        click: () => {
          const trackRaw = toRaw(track.value);
          if (!trackRaw) return;
          openInfoWindow(() => {
            Renderer.sendMessage("infoSync", "info", {
              type: "comments",
              value: {
                type: 0,
                id: trackRaw.id,
                track: trackRaw
              }
            });
          });
        }
      },
      {
        icon: Copy,
        text: "复制歌名",
        click: () => copy(track.value?.name)
      },
      {
        icon: Copy,
        text: "复制歌手名",
        click: () => copy(track.value?.ar.map((a) => a.name).join(" / "))
      },
      {
        icon: Copy,
        text: "复制专辑名",
        click: () => copy(track.value?.al.name)
      },
      {
        icon: LogOut,
        text: "退出",
        click: () => Renderer.sendMessage("playerControl", "main", "exit")
      }
    ];
    if (playerStatusSync.value?.fsmState === PlayerFSMStatusEnum.playing) {
      result.unshift({
        icon: Pause,
        text: "暂停",
        click: () => Renderer.sendMessage("playerControl", "main", "pause")
      });
    } else {
      result.unshift({
        icon: Play,
        text: "播放",
        click: () => Renderer.sendMessage("playerControl", "main", "play")
      });
    }
    return result;
  });

  function copy(text: Optional<string>) {
    if (!text) return;
    window.navigator.clipboard.writeText(text);
  }

  function openInfoWindow(cb: NormalFunc) {
    Renderer.invoke.hasOpenInternalWindow("info").then((ok) => {
      if (!ok) {
        Renderer.sendMessage("playerControl", "main", "openInfoWindow");
        Renderer.addMessageHandler("otherWindowLoaded", "info", cb, { once: true });
      } else {
        cb();
      }
    });
  }

  function resizeTrayWindow() {
    const deltaX = window.innerWidth - (containerRef.value?.offsetWidth || window.innerWidth);
    const deltaY = window.innerHeight - (containerRef.value?.offsetHeight || window.innerHeight);

    Renderer.event.resizeWindow({
      width: containerRef.value?.offsetWidth || window.innerWidth,
      height: containerRef.value?.offsetHeight || window.innerHeight
    });
    Renderer.event.moveWindow({
      x: window.screenX + deltaX,
      y: window.screenY + deltaY
    });
  }

  let observer: ResizeObserver;
  onMounted(() => {
    requestThemeSync();
    requestPlayerTrackSync();
    requestPlayerStatusSync();
    observer = new ResizeObserver(resizeTrayWindow);
    containerRef.value && observer.observe(containerRef.value);
  });
  onUnmounted(() => {
    observer.disconnect();
  });

  watch(
    themeSync,
    () => {
      document.documentElement.style.setProperty("--theme-color-main", themeSync.value.mainColor);
      document.documentElement.style.setProperty(
        "--text-color-on-main",
        themeSync.value.textColorOnMain
      );
    },
    { immediate: true }
  );
  watch(
    () => track.value?.id,
    () => {
      const name = track.value?.name;
      const artist = track.value?.ar.map((a) => a.name).join(" / ");
      if (name && artist) {
        document.title = `${name} - ${artist}`;
      }
    }
  );
</script>

<style scoped lang="scss"></style>
