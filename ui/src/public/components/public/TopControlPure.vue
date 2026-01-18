<template>
  <NoDrag class="flex flex-row gap-4 select-none relative z-10">
    <Chromium
      v-if="isDev"
      :color="props.color"
      class="size-5 control-button"
      @click="Renderer.event.openDevTools" />
    <Minus
      v-if="props.mini"
      :color="props.color"
      class="size-5 control-button"
      @click="Renderer.event.minimize" />
    <Square
      v-if="props.maximizable"
      v-show="isMax"
      :color="props.color"
      class="size-5 control-button"
      @click="maximize" />
    <SquareMinus
      v-if="props.maximizable"
      v-show="!isMax"
      :color="props.color"
      class="size-5 control-button"
      @click="maximize" />
    <X :color="props.color" class="size-5 control-button" @click="close" />
  </NoDrag>
</template>

<script setup lang="ts" name="TopControlPure">
  import NoDrag from "@mahiru/ui/public/components/drag/NoDrag.vue";
  import { Chromium, Minus, Square, SquareMinus, X } from "lucide-vue-next";
  import { isDev } from "@mahiru/ui/public/utils/dev";
  import { Renderer } from "@mahiru/ui/public/entry/renderer";
  import { runCloseTask } from "@mahiru/ui/public/utils/close";
  import { onMounted, ref } from "vue";

  const isMax = ref(false);

  const props = withDefaults(
    defineProps<{
      maximizable?: boolean;
      mini?: boolean;
      color?: string;
    }>(),
    {
      mini: true
    }
  );

  function close() {
    Renderer.event.hidden();
    runCloseTask();
  }

  function maximize() {
    if (isMax.value) {
      Renderer.event.unmaximize();
      isMax.value = false;
    } else {
      Renderer.event.maximize();
      isMax.value = true;
    }
  }

  onMounted(() => {
    Renderer.invoke.isMaximized().then((max) => {
      isMax.value = max;
    });
  });
</script>

<style scoped lang="scss">
  .control-button {
    cursor: pointer;
    scale: 80%;
    transition: all ease-in-out 0.3s;

    &:hover {
      opacity: 0.5;
    }
  }
</style>
