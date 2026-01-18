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

  function reset() {
    scale.value = 1;
    translate.value = { x: 0, y: 0 };
  }

  function calcAbsoluteContainedImageSize(img: HTMLImageElement) {
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return { width: 0, height: 0 };

    const boxW = img.offsetWidth;
    const boxH = img.offsetHeight;
    const imgRatio = naturalW / naturalH;
    const boxRatio = boxW / boxH;

    if (imgRatio > boxRatio) {
      // 图片更"宽"，宽度撑满，高度按比例
      return { width: boxW, height: boxW / imgRatio };
    } else {
      // 图片更"高"，高度撑满，宽度按比例
      return { width: boxH * imgRatio, height: boxH };
    }
  }

  function calcImageTranslateBounds() {
    const viewer = viewerRef.value;
    const image = imageRef.value;
    if (!viewer || !image) return { maxX: 0, maxY: 0 };

    const viewerWidth = viewer.clientWidth;
    const viewerHeight = viewer.clientHeight;

    const { width: baseW, height: baseH } = calcAbsoluteContainedImageSize(image);
    const scaledW = baseW * scale.value;
    const scaledH = baseH * scale.value;

    const maxX = Math.max(0, (scaledW - viewerWidth) / 2);
    const maxY = Math.max(0, (scaledH - viewerHeight) / 2);
    return { maxX, maxY };
  }

  function applyRubberBand(value: number, max: number, damping = 0.4): number {
    if (value > max) {
      // 正向越界
      return max + (value - max) * damping;
    } else if (value < -max) {
      // 负向越界
      return -max + (value + max) * damping;
    }
    return value;
  }

  function rubberBandTranslate() {
    const { maxX, maxY } = calcImageTranslateBounds();
    translate.value.x = applyRubberBand(translate.value.x, maxX);
    translate.value.y = applyRubberBand(translate.value.y, maxY);
  }

  function onWheel(e: WheelEvent) {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale.value = clamp(scale.value + delta, 0.2, 5);

    rubberBandTranslate();
  }

  let last = { x: 0, y: 0 };
  let moved = false;
  let lastTap = 0;
  function onPointerDown(e: PointerEvent) {
    rubberBandTranslate();
    dragging.value = true;
    last = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;

    if (Math.abs(dx) + Math.abs(dy) > 4) {
      moved = true;
    }

    translate.value.x += dx;
    translate.value.y += dy;

    rubberBandTranslate();

    last = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: PointerEvent) {
    dragging.value = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    rubberBandTranslate();

    const now = performance.now();
    if (!moved && now - lastTap < 300) {
      reset();
    }
    lastTap = now;
    moved = false;
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
