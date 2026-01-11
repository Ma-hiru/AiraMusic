<template>
  <div :style="styles">
    <slot name="default" />
  </div>
</template>

<script setup lang="ts" name="Drag">
  import { computed } from "vue";

  const props = withDefaults(
    defineProps<{
      draggable: boolean;
    }>(),
    {
      draggable: true
    }
  );

  const styles = computed(() => {
    return {
      "-webkit-app-region": props.draggable ? "drag" : "no-drag"
    };
  });
</script>

<style scoped lang="scss"></style>
