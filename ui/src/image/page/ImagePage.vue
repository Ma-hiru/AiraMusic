<template>
  <div class="w-screen h-screen bg-black relative">
    <Drag
      class="absolute left-0 right-0 w-screen flex justify-end items-center px-4 py-2 z-50 duration-500 transition-all ease-in-out h-[36px]"
      :class="showToolBar ? 'show-control' : 'hide-control'">
      <TopControlPure color="#ffffff" />
    </Drag>
    <ImageViewer :images="images" @tool-bar-change="(visible) => (showToolBar = visible)" />
  </div>
</template>

<script setup lang="ts" name="ImagePage">
  import TopControlPure from "@mahiru/ui/public/components/public/TopControlPure.vue";
  import Drag from "@mahiru/ui/public/components/drag/Drag.vue";
  import ImageViewer from "@mahiru/ui/public/components/image/ImageViewer.vue";
  import { useAppLoadedVue } from "@mahiru/ui/public/hooks/useAppLoadedVue";
  import { onMounted, reactive, ref } from "vue";
  import { Renderer } from "@mahiru/ui/public/entry/renderer";

  const { requestLoaded } = useAppLoadedVue(undefined, { broadcast: true });
  const images = reactive<{ url?: string; alt?: string }[]>([]);
  const showToolBar = ref(false);

  onMounted(() => {
    Renderer.addMessageHandler("checkImage", ["main", "info"] satisfies WindowType[], (sync) => {
      const exits = images.findIndex((image) => image.url === sync.url);
      if (exits === -1) {
        images.push({
          url: sync.url || undefined,
          alt: sync.alt || undefined
        });
      }
    });
    requestLoaded();
  });
</script>

<style scoped lang="scss">
  .show-control {
    top: 0;
  }
  .hide-control {
    top: -36px;
  }
</style>
