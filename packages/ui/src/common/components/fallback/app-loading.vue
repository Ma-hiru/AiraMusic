<template>
  <div
    v-if="props.loading"
    :style="{ color: props.color }"
    class="px-2 py-1 w-full h-full flex flex-col gap-2 justify-center items-center text-white">
    <Loading class="size-8" />
    <span class="font-semibold">{{ props.tips }}</span>
  </div>
  <slot v-else name="default" />
</template>

<script setup lang="ts" name="AppLoading">
  import Loading from "@/common/components/fallback/loading.vue";

  const props = withDefaults(
    defineProps<{
      loading: boolean;
      color?: string;
      tips?: string;
    }>(),
    {
      tips: "数据努力加载中"
    }
  );
</script>

<style scoped lang="scss"></style>
