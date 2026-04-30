<template>
  <Drag
    class="w-screen h-screen overflow-hidden relative bg-white rounded-md text-black grid grid-rows-1 grid-cols-[auto_1fr] px-2 py-1 items-center select-none">
    <div class="h-12 w-12 rounded-md overflow-hidden border border-gray-300/50">
      <NeteaseImage
        :cache="true"
        :image="image"
        style="width: 100%; height: 100%"
        shadow-color="dark" />
    </div>
    <div class="h-full w-full flex flex-col justify-center px-2 gap-1.5 overflow-hidden">
      <div class="flex items-center justify-center gap-1">
        <span class="text-[12px] font-bold truncate">{{ track?.name }}</span>
        <span class="text-[12px]"> - </span>
        <span class="text-[10px] font-medium truncate opacity-50">
          {{ track?.ar?.map((a) => a.name).join("/") }}
        </span>
      </div>
      <div class="grid grid-rows-1 grid-cols-[1fr_auto] items-center justify-center gap-1">
        <div class="h-1.25 bg-gray-500 rounded-full overflow-hidden">
          <span
            class="h-full block bg-white/80 ease-in-out duration-300 transition-all"
            :style="{ width: `${percent}%` }" />
        </div>
      </div>
      <NoDrag class="flex items-center gap-2 justify-center">
        <SkipBack
          class="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
          @click="ElectronServices.Bus.playerAction.send('previous')"
          fill="#171b20" />
        <Pause
          v-if="playerBus.data?.status === 'playing'"
          class="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
          @click="ElectronServices.Bus.playerAction.send('pause')"
          fill="#171b20" />
        <Play
          v-else
          class="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
          @click="ElectronServices.Bus.playerAction.send('play')"
          fill="#171b20" />
        <SkipForward
          class="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
          @click="ElectronServices.Bus.playerAction.send('next')"
          fill="#171b20" />
      </NoDrag>
    </div>
    <NoDrag class="absolute right-1 top-1">
      <X class="size-4 hover:opacity-50 cursor-pointer active:text-white/80" @click="close" />
    </NoDrag>
  </Drag>
</template>
<script setup lang="ts">
  import Drag from "@mahiru/ui/public/components/drag/Drag.vue";
  import NoDrag from "@mahiru/ui/public/components/drag/NoDrag.vue";
  import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage.vue";
  import useListenableHookVue from "@mahiru/ui/public/hooks/useListenableHookVue";
  import ElectronServices from "@mahiru/ui/public/source/electron/services";
  import { Pause, Play, SkipBack, SkipForward, X } from "lucide-vue-next";
  import { computed } from "vue";
  import { clamp } from "lodash-es";
  import { NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";
  import { NeteaseImageSize } from "@mahiru/ui/public/enum";

  const mainWindow = useListenableHookVue(ElectronServices.Window.main);
  const currentWindow = useListenableHookVue(ElectronServices.Window.current);
  const playerBus = useListenableHookVue(ElectronServices.Bus.player);
  const progressBus = useListenableHookVue(ElectronServices.Bus.progress);
  const track = computed(() => playerBus.value.data?.track?.detail);
  const percent = computed(() => {
    const currentTime = progressBus.value.data?.currentTime || 0;
    const duration = progressBus.value.data?.duration || 1;
    return clamp((currentTime / duration) * 100, 0, 100);
  });
  const image = computed(() => {
    return NeteaseNetworkImage.fromTrackCover(track.value)?.setSize(NeteaseImageSize.sm);
  });

  function close() {
    currentWindow.value.hide();
    mainWindow.value.show();
  }
</script>
<style scoped lang="scss"></style>
