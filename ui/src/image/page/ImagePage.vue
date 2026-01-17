<template>
  <div class="w-screen h-screen bg-black">
    <Drag class="absolute top-0 left-0 right-0 w-screen flex justify-end items-center px-4 py-2">
      <TopControlPure color="#ffffff" />
    </Drag>
    <img
      :class="[
        'w-full h-full object-contain',
        status === 'loaded' ? '' : 'hidden',
        status === 'loading' ? 'animate-pulse' : '',
        status === 'error' ? 'hidden' : ''
      ]"
      :src="url"
      alt=""
      @loadstart="status = 'loading'"
      @load="status = 'loaded'"
      @error="status = 'error'" />
  </div>
</template>

<script setup lang="ts" name="ImagePage">
  import TopControlPure from "@mahiru/ui/public/components/public/TopControlPure.vue";
  import Drag from "@mahiru/ui/public/components/public/Drag.vue";
  import { useAppLoadedVue } from "@mahiru/ui/public/hooks/useAppLoadedVue";
  import { onMounted, ref, watch } from "vue";
  import { Renderer } from "@mahiru/ui/public/entry/renderer";
  import { NeteaseImage } from "@mahiru/ui/public/entry/image";

  const { requestLoaded } = useAppLoadedVue(undefined, { broadcast: true });
  const url = ref<Undefinable<string>>(undefined);
  const status = ref<"idle" | "loading" | "error" | "loaded">("idle");

  onMounted(() => {
    Renderer.addMessageHandler(
      "checkImage",
      ["main", "info"] satisfies WindowType[],
      (imageURL) => {
        const cacheURL = NeteaseImage.fetchCacheURL(imageURL);
        url.value = cacheURL || imageURL || undefined;
      }
    );
    requestLoaded();
  });

  watch(url, (newURL) => {
    if (newURL && newURL !== url.value) {
      status.value = "idle";
    }
  });
</script>

<style scoped lang="scss"></style>
