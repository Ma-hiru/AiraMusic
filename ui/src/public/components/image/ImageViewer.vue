<template>
  <div
    ref="viewerRef"
    class="viewer"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp">
    <img
      :src="props.src"
      :alt="props.alt"
      :style="imgStyle"
      :class="[
        status === 'loaded' ? '' : 'hidden',
        status === 'loading' ? 'animate-pulse' : '',
        status === 'error' ? 'hidden' : ''
      ]"
      ref="imageRef"
      draggable="false"
      @loadstart="status = 'loading'"
      @load="status = 'loaded'"
      @error="status = 'error'" />
  </div>
</template>

<script setup lang="ts" name="ImageViewer">
  import { computed, ref, CSSProperties, watch, useTemplateRef } from "vue";
  import { clamp } from "lodash-es";

  const viewerRef = useTemplateRef<HTMLDivElement>("viewerRef");
  const imageRef = useTemplateRef<HTMLImageElement>("imageRef");
  const status = ref<"idle" | "loading" | "error" | "loaded">("idle");
  const props = defineProps<{ src?: string; alt?: string }>();
  const scale = ref(1);
  const translate = ref({ x: 0, y: 0 });
  const dragging = ref(false);
  const imgStyle = computed<CSSProperties>(() => {
    return {
      transform: `translate(${translate.value.x}px, ${translate.value.y}px) scale(${scale.value})`,
      transition: dragging.value ? `none` : `transform 0.2s ease`
    };
  });

  watch(
    () => props.src,
    (newURL, oldURL) => {
      if (newURL !== oldURL) {
        status.value = "idle";
      }
    }
  );

  function onWheel(e: WheelEvent) {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale.value = clamp(scale.value + delta, 0.2, 5);

    clampTranslate();
  }

  function clampTranslate() {
    const viewer = viewerRef.value;
    const image = imageRef.value;
    if (!viewer || !image) return;

    const viewerWidth = viewer.clientWidth;
    const viewerHeight = viewer.clientHeight;

    const imageWidth = image.offsetWidth * scale.value;
    const imageHeight = image.offsetHeight * scale.value;

    const maxX = Math.max(0, (imageWidth - viewerWidth) / 2);
    const maxY = Math.max(0, (imageHeight - viewerHeight) / 2);

    translate.value.x = clamp(translate.value.x, -maxX, maxX);
    translate.value.y = clamp(translate.value.y, -maxY, maxY);
  }

  let last = { x: 0, y: 0 };
  function onPointerDown(e: PointerEvent) {
    dragging.value = true;
    last = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  let moved = false;
  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;

    if (Math.abs(dx) + Math.abs(dy) > 4) {
      moved = true;
    }

    translate.value.x += dx;
    translate.value.y += dy;

    clampTranslate();

    last = { x: e.clientX, y: e.clientY };
  }

  let lastTap = 0;
  function onPointerUp(e: PointerEvent) {
    dragging.value = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    clampTranslate();

    const now = performance.now();
    if (!moved && now - lastTap < 300) {
      reset();
    }
    lastTap = now;
    moved = false;
  }

  function reset() {
    scale.value = 1;
    translate.value = { x: 0, y: 0 };
  }
</script>

<style scoped lang="scss">
  .viewer {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000000;
    display: flex;
    justify-content: center;
    align-items: center;
    user-select: none;
  }

  img {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    cursor: grab;
    will-change: transform;
    object-fit: contain;
  }
</style>
