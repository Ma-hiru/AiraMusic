<template>
  <div class="w-full h-full relative" @mousemove.passive="toggleToolBar(true)">
    <slot class="absolute" name="default" />
    <div class="viewer-title" :class="toolBarVisible && 'active'">
      <span class="max-w-2/3 truncate text-center">
        {{ current.alt || current.url }}
      </span>
      <span v-if="props.images.length && props.images.length > 1">
        {{ ` (${index + 1}/${props.images.length}) ` }}
      </span>
    </div>
    <div class="viewer-button" :class="toolBarVisible && 'active'">
      <ArrowLeftToLine
        v-if="props.images.length > 1"
        class="cursor-pointer hover:opacity-50 active:scale-90 duration-300 transition-all ease-in-out size-5"
        color="#ffffff"
        @click.passive="lastImage" />
      <Download
        class="cursor-pointer hover:opacity-50 active:scale-90 duration-300 transition-all ease-in-out size-5"
        color="#ffffff"
        @click.passive="saveImage" />
      <ArrowRightToLine
        v-if="props.images.length > 1"
        class="cursor-pointer hover:opacity-50 active:scale-90 duration-300 transition-all ease-in-out size-5"
        color="#ffffff"
        @click.passive="nextImage" />
    </div>
    <div
      ref="viewerRef"
      class="viewer"
      @wheel.prevent="onWheel"
      @pointerdown.passive="onPointerDown"
      @pointermove.passive="onPointerMove"
      @pointerup.passive="onPointerUp"
      @pointerleave.passive="onPointerUp">
      <img
        :src="current?.url"
        :alt="current?.alt"
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
  </div>
</template>

<script setup lang="ts" name="ImageViewer">
  import { computed, CSSProperties, onMounted, ref, useTemplateRef, watch } from "vue";
  import { clamp } from "lodash-es";
  import { ArrowLeftToLine, ArrowRightToLine, Download } from "lucide-vue-next";
  import { EqError, Log } from "@mahiru/ui/public/utils/dev";
  import { Renderer } from "@mahiru/ui/public/entry/renderer";

  type ImageEntry = { url?: string; alt?: string };

  const viewerRef = useTemplateRef<HTMLDivElement>("viewerRef");
  const imageRef = useTemplateRef<HTMLImageElement>("imageRef");
  const status = ref<"idle" | "loading" | "error" | "loaded">("idle");
  const props = defineProps<{ images: ImageEntry[] }>();
  const index = ref(0);
  const current = computed<ImageEntry>(() => {
    return props.images[index.value] || {};
  });
  const scale = ref(1);
  const translate = ref({ x: 0, y: 0 });
  const dragging = ref(false);
  const toolBarVisible = ref(false);
  const moved = ref(false);
  const imgStyle = computed<CSSProperties>(() => {
    return {
      transform: `translate(${translate.value.x}px, ${translate.value.y}px) scale(${scale.value})`,
      transition: dragging.value ? `none` : `transform 0.2s ease`,
      cursor: moved.value ? `move` : `default`
    };
  });
  const emit = defineEmits<{
    (e: "toolBarChange", visible: boolean): void;
  }>();

  watch(current, () => {
    document.title = current.value.alt || current.value.url || "Image Viewer";
  });

  watch(
    () => [props.images, props.images.length],
    () => {
      if (index.value !== props.images.length - 1) {
        status.value = "idle";
        index.value = Math.max(0, props.images.length - 1);
      }
    }
  );

  onMounted(() => {
    emit("toolBarChange", toolBarVisible.value);
  });

  async function saveImage() {
    if (status.value === "loaded" && current.value.url) {
      try {
        let type = "";
        const buffer = await fetch(current.value.url).then((res) => {
          if (!res.ok) throw new EqError({ message: "网络错误" });
          const contentType = res.headers.get("content-type");
          if (contentType) type = contentType.split("/")[1]?.split(";")[0] || "jpg";
          return res.arrayBuffer();
        });
        const splitSrc = current.value.url.split("/");
        const name =
          (current.value.alt ? `${current.value.alt}.${type}` : "") ||
          splitSrc[splitSrc.length - 1] ||
          current.value.url ||
          `unknown.${type}`;
        const result = (await Renderer.invoke.writeFile(<{ buffer: ArrayBuffer; name: string }>{
          buffer,
          name
        })) as { error?: string; ok: boolean };
        if (result.error) {
          Log.error(result.error);
        }
      } catch (err) {
        Log.error(err);
      }
    }
  }

  function lastImage() {
    index.value = index.value - 1 >= 0 ? index.value - 1 : props.images.length - 1;
  }

  function nextImage() {
    index.value = (index.value + 1) % props.images.length;
  }

  let toolBarTimer = 0;
  function toggleToolBar(visible?: boolean) {
    requestAnimationFrame(() => {
      if (typeof visible === "boolean") {
        toolBarVisible.value = visible;
      } else {
        toolBarVisible.value = !toolBarVisible.value;
      }
      emit("toolBarChange", toolBarVisible.value);
      if (toolBarVisible.value) {
        toolBarTimer && window.clearTimeout(toolBarTimer);
        toolBarTimer = window.setTimeout(() => {
          toolBarVisible.value = false;
          emit("toolBarChange", false);
        }, 3000);
      } else {
        toolBarTimer && window.clearTimeout(toolBarTimer);
      }
    });
  }

  function reset() {
    scale.value = 1;
    translate.value = { x: 0, y: 0 };
  }

  function isReset() {
    return scale.value === 1 && translate.value.x === 0 && translate.value.y === 0;
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

  function limitImageTranslate() {
    const { maxX, maxY } = calcImageTranslateBounds();
    translate.value.x = clamp(translate.value.x, -maxX, maxX);
    translate.value.y = clamp(translate.value.y, -maxY, maxY);
  }

  function center() {
    const image = imageRef.value;
    const viewer = viewerRef.value;
    if (!image || !viewer) return;

    const { width: containW, height: containH } = calcAbsoluteContainedImageSize(image);
    if (!containW || !containH) return;

    const viewerW = viewer.clientWidth;
    const viewerH = viewer.clientHeight;

    // 计算从 contain 到 cover 需要的缩放比例
    const scaleX = viewerW / containW;
    const scaleY = viewerH / containH;
    // 居中放大，translate 保持为 0
    scale.value = Math.max(scaleX, scaleY);
    translate.value = { x: 0, y: 0 };
  }

  function zoomAtPoint(clientX: number, clientY: number) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const viewerRect = viewer.getBoundingClientRect();
    // 鼠标相对于 viewer 中心的位置（因为图片是居中显示的）
    const centerX = viewerRect.width / 2;
    const centerY = viewerRect.height / 2;
    const mouseX = clientX - viewerRect.left - centerX;
    const mouseY = clientY - viewerRect.top - centerY;

    const prevScale = scale.value;
    const nextScale = isReset() ? 2 : 1;

    // 保持鼠标指向的图片上的点不变
    translate.value.x = mouseX - ((mouseX - translate.value.x) * nextScale) / prevScale;
    translate.value.y = mouseY - ((mouseY - translate.value.y) * nextScale) / prevScale;
    scale.value = nextScale;

    limitImageTranslate();
  }

  function onWheel(e: WheelEvent) {
    const viewer = viewerRef.value;
    if (!viewer) return;

    const rect = viewer.getBoundingClientRect();
    // 鼠标相对于 viewer 中心的位置（因为图片是居中显示的）
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const mouseX = e.clientX - rect.left - centerX;
    const mouseY = e.clientY - rect.top - centerY;

    const prevScale = scale.value;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const nextScale = clamp(scale.value + delta, 0.2, 5);

    // 保持鼠标指向的图片上的点不变
    translate.value.x = mouseX - ((mouseX - translate.value.x) * nextScale) / prevScale;
    translate.value.y = mouseY - ((mouseY - translate.value.y) * nextScale) / prevScale;

    scale.value = nextScale;
    limitImageTranslate();
  }

  function dClick(clientX: number, clientY: number) {
    if (isReset()) {
      zoomAtPoint(clientX, clientY);
    } else {
      reset();
    }
  }

  function click() {
    toggleToolBar();
  }

  let last = { x: 0, y: 0 };
  let startPos = { x: 0, y: 0 };
  function onPointerDown(e: PointerEvent) {
    dragging.value = true;
    moved.value = false;
    last = { x: e.clientX, y: e.clientY };
    startPos = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;

    // 使用起始位置计算总移动距离，阈值设为 10 像素
    const totalDx = e.clientX - startPos.x;
    const totalDy = e.clientY - startPos.y;
    if (Math.abs(totalDx) + Math.abs(totalDy) > 10) {
      moved.value = true;
    }

    translate.value.x += dx;
    translate.value.y += dy;

    limitImageTranslate();

    last = { x: e.clientX, y: e.clientY };
  }

  let singleTapTimer = 0;
  let lastTapTime = 0;
  let lastTapPos = { x: 0, y: 0 };
  function onPointerUp(e: PointerEvent) {
    dragging.value = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    // 如果是移动过的，则不触发点击事件
    if (moved.value) return (moved.value = false);
    // 处理点击事件
    handleClickEvent(e);
  }

  function handleClickEvent(e: PointerEvent) {
    const now = performance.now();
    const tapDist = Math.hypot(e.clientX - lastTapPos.x, e.clientY - lastTapPos.y);
    // 双击条件：时间间隔小于 300ms、两次点击位置距离小于 30px
    if (now - lastTapTime < 300 && tapDist < 30) {
      singleTapTimer && window.clearTimeout(singleTapTimer);
      lastTapTime = 0;
      lastTapPos = { x: 0, y: 0 };
      dClick(e.clientX, e.clientY);
    } else {
      // 否则，记录本次点击时间和位置，等待单击定时器
      lastTapTime = now;
      lastTapPos = { x: e.clientX, y: e.clientY };
      singleTapTimer && window.clearTimeout(singleTapTimer);
      singleTapTimer = window.setTimeout(click, 300);
    }
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
    will-change: transform;
    object-fit: contain;
  }

  @mixin tool-bar {
    position: absolute;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    z-index: 5;
    height: 36px;
    transition: all 0.5s ease-in-out;
  }

  .viewer-title {
    @include tool-bar;
    top: -36px;
    color: white;
    font-weight: 500;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;

    &.active {
      top: 0;
    }
  }

  .viewer-button {
    @include tool-bar;
    bottom: -36px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 32px;

    &.active {
      bottom: 0;
    }
  }
</style>
