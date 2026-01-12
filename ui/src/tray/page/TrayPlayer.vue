<template>
  <div class="grid items-center grid-rows-1 grid-cols-[auto_1fr] px-2">
    <NeteaseImage
      class="size-8 rounded-md select-none ease-in-out duration-300 transition-all"
      :src="props.track?.al.picUrl"
      :alt="props.track?.al.name"
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
  import NeteaseImage from "@mahiru/ui/public/components/public/NeteaseImage.vue";
  import { NeteaseImageSize } from "@mahiru/ui/public/enum";

  const props = defineProps<{
    track: Undefinable<NeteaseTrack>;
  }>();
</script>

<style scoped lang="scss"></style>
