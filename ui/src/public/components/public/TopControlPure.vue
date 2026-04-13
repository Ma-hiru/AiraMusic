<template>
  <NoDrag class="flex flex-row gap-4 select-none relative z-50">
    <AppWindowIcon
      v-if="isDev"
      :color="props.color"
      class="size-5 control-button"
      @click="currentWindow.devTools()" />
    <Minus
      v-if="props.mini"
      :color="props.color"
      class="size-5 control-button"
      @click="currentWindow.minimize()" />
    <Square
      v-if="props.maximizable"
      v-show="currentWindow.isMax"
      :color="props.color"
      class="size-5 control-button"
      @click="currentWindow.unmaximize()" />
    <SquareMinus
      v-if="props.maximizable"
      v-show="!currentWindow.isMax"
      :color="props.color"
      class="size-5 control-button"
      @click="currentWindow.maximize()" />
    <X :color="props.color" class="size-5 control-button" @click="currentWindow.close()" />
  </NoDrag>
</template>

<script setup lang="ts" name="TopControlPure">
  import NoDrag from "@mahiru/ui/public/components/drag/NoDrag.vue";
  import { AppWindow as AppWindowIcon, Minus, Square, SquareMinus, X } from "lucide-vue-next";
  import { isDev } from "@mahiru/ui/public/utils/dev";
  import useListenableHookVue from "@mahiru/ui/public/hooks/useListenableHookVue";
  import ElectronServices from "@mahiru/ui/public/source/electron/services";

  const currentWindow = useListenableHookVue(ElectronServices.Window.current);

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
