<template>
  <div
    class="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-(--theme-color-main) hover:text-(--text-color-on-main) cursor-pointer">
    <Icon size="14" />
    <span class="text-[12px]">{{ props.text }}</span>
  </div>
</template>

<script setup lang="ts" name="TrayItem">
  import { Component, computed } from "vue";

  const props = defineProps<{ icon: Component; text: string }>();
  const Icon = computed(() => props.icon);
</script>

<style scoped lang="scss"></style>
