<template>
  <div class="w-screen h-screen bg-black relative">
    <ImageViewer :images="images" @tool-bar-change="(visible) => (showToolBar = visible)">
      <Drag
        class="absolute left-0 right-0 top-0 w-screen flex justify-end items-center px-4 py-2 z-50 duration-500 transition-all ease-in-out h-9"
        :class="showToolBar ? 'show-control' : 'hide-control'">
        <TopControlPure color="#ffffff" />
      </Drag>
    </ImageViewer>
  </div>
</template>

<script setup lang="ts" name="ImagePage">
  import TopControlPure from "@/common/components/top/control.vue";
  import Drag from "@/common/components/drag/drag.vue";
  import ImageViewer from "@/common/components/image/image-viewer.vue";
  import { ElectronServicesWindow } from "@/common/source/electron/services";
  import { useAppLoadedVue } from "@/common/hooks/use-app-loaded-vue";
  import { onMounted, reactive, ref } from "vue";

  const loading = ref(false);
  const images = reactive<{ url: string; alt?: string }[]>([]);
  const showToolBar = ref(false);

  useAppLoadedVue(loading);

  onMounted(() => {
    ElectronServicesWindow.all.listenMessageAll("imageCheckerBus", (props) => {
      const { url, alt } = props.data;
      const exits = images.findIndex((image) => image.url === url);
      if (exits === -1) {
        images.push({ url, alt });
      }
    });
    loading.value = true;
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
