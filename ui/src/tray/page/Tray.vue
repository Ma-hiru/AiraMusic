<template>
  <div>tray</div>
</template>

<script setup lang="ts" name="Tray">
  import { Renderer } from "@mahiru/ui/public/entry/renderer";
  import { onMounted } from "vue";

  onMounted(() => {
    Renderer.event.openDevTools();
  });
</script>

<style scoped lang="scss"></style>
