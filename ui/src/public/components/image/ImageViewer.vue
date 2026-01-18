<template>
  <Teleport to="body">
    <div v-if="visible" class=""></div>
  </Teleport>
</template>

<script setup lang="ts" name="ImageViewer">
  import { computed, ref } from "vue";

  const props = defineProps<{ src?: string }>();
  const scale = ref(1);
  const translate = ref({ x: 0, y: 0 });
  const imgStyle = computed(() => {
    return {
      transform: `scale(${scale.value}) translate(${translate.value.x}px, ${translate.value.y}px)`
    };
  });
</script>

<style scoped lang="scss">
  .viewer-mask {
    position: fixed;
  }
</style>
