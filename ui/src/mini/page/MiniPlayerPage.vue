<template>
  <Drag
    class="w-screen h-screen overflow-hidden relative bg-white rounded-md text-black grid grid-rows-1 grid-cols-[auto_1fr] px-2 py-1 items-center select-none">
    <div class="h-12 w-12 rounded-md overflow-hidden">
      <NeteaseImage
        style="width: 100%; height: 100%"
        :src="track?.al.picUrl"
        :size="NeteaseImageSize.sm"
        :alt="track?.name"
        shadow-color="light" />
    </div>
    <div class="h-full w-full flex flex-col justify-center px-2 gap-1.5 overflow-hidden">
      <div class="flex items-center justify-center gap-1">
        <span class="text-[12px] font-bold truncate">{{ track?.name }}</span>
        <span class="text-[12px]"> - </span>
        <span class="text-[10px] font-medium truncate opacity-50">
          {{ track?.ar.map((a) => a.name).join("/") }}
        </span>
      </div>
      <div class="grid grid-rows-1 grid-cols-[1fr_auto] items-center justify-center gap-1">
        <div class="h-[5px] bg-gray-500 rounded-full overflow-hidden">
          <span
            class="h-full block bg-white/80 ease-in-out duration-300 transition-all"
            :style="{ width: `${percent}%` }" />
        </div>
      </div>
      <NoDrag class="flex items-center gap-2 justify-center">
        <SkipBack
          class="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
          @click="Renderer.sendMessage('playerControl', 'main', 'last')"
          fill="#171b20" />
        <Pause
          v-if="playerStatusSync?.fsmState === PlayerFSMStatusEnum.playing"
          class="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
          @click="Renderer.sendMessage('playerControl', 'main', 'play')"
          fill="#171b20" />
        <Play
          v-else
          class="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
          @click="Renderer.sendMessage('playerControl', 'main', 'play')"
          fill="#171b20" />
        <SkipForward
          class="size-3 hover:scale-90 hover:opacity-50 active:scale-80 cursor-pointer ease-in-out transition-all duration-300"
          @click="Renderer.sendMessage('playerControl', 'main', 'next')"
          fill="#171b20" />
      </NoDrag>
    </div>
    <NoDrag class="absolute right-1 top-1">
      <X
        class="size-4 hover:opacity-50 cursor-pointer active:text-white/80"
        @click="Renderer.event.close({ broadcast: true })" />
    </NoDrag>
  </Drag>
</template>
<script setup lang="ts">
  import Drag from "@mahiru/ui/public/components/drag/Drag.vue";
  import NoDrag from "@mahiru/ui/public/components/drag/NoDrag.vue";
  import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage.vue";
  import { Pause, Play, SkipBack, SkipForward, X } from "lucide-vue-next";
  import { usePlayerTrackSyncReceiveVue } from "@mahiru/ui/public/hooks/usePlayerTrackSyncReceiveVue";
  import { usePlayerProgressSyncReceiveVue } from "@mahiru/ui/public/hooks/usePlayerProgressSyncReceiveVue";
  import { usePlayerStatusSyncReceiveVue } from "@mahiru/ui/public/hooks/usePlayerStatusSyncReceiveVue";
  import { computed, onMounted } from "vue";
  import { Renderer } from "@mahiru/ui/public/entry/renderer";
  import { NeteaseImageSize, PlayerFSMStatusEnum } from "@mahiru/ui/public/enum";
  import { useAppLoadedVue } from "@mahiru/ui/public/hooks/useAppLoadedVue";

  const { requestLoaded } = useAppLoadedVue(undefined, { broadcast: true });
  const { trackSync } = usePlayerTrackSyncReceiveVue();
  const { progressSync } = usePlayerProgressSyncReceiveVue();
  const { playerStatusSync } = usePlayerStatusSyncReceiveVue();

  const track = computed(() => {
    return trackSync.value?.track;
  });
  const percent = computed(() => {
    return progressSync.value.duration
      ? Math.min(((progressSync.value.currentTime || 0) / progressSync.value.duration) * 100, 100)
      : 0;
  });

  onMounted(() => {
    Renderer.event.openDevTools();
    requestLoaded();
  });
</script>
<style scoped lang="scss"></style>
