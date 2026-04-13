<template>
  <div class="grid items-center grid-rows-1 grid-cols-[auto_1fr] px-2">
    <NeteaseImage
      cache
      class="size-8 rounded-md select-none ease-in-out duration-300 transition-all"
      :image="
        NeteaseNetworkImage.fromTrackCover(props.track)
          .setSize(NeteaseImageSize.sm)
          .setAlt(props.track.al.name)
      "
      :size="NeteaseImageSize.sm"
      shadowColor="light" />
    <div
      class="w-full overflow-hidden flex flex-col items-start justify-center px-2 select-none truncate">
      <p class="w-full font-semibold text-left text-[12px] truncate">{{ props.track?.name }}</p>
      <p class="w-full font-normal text-left text-[8px] opacity-50 truncate">
        {{ props.track?.ar.map((ar) => ar.name).join(" / ") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts" name="TrayPlayer">
  import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage.vue";
  import { NeteaseImageSize } from "@mahiru/ui/public/enum";
  import { NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";

  const props = defineProps<{
    track: NeteaseTrackModel;
  }>();
</script>

<style scoped lang="scss"></style>
