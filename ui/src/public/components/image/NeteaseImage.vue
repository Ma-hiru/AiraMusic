<template>
  <div
    class="bg-white/10 backdrop-blur-sm border-none overflow-hidden"
    :class="[shadow && shadowMap[shadow][shadowColor], props.containerClass]"
    @click="wrapClick">
    <img
      v-bind="imageAttrs"
      class="w-full h-full object-cover aspect-square"
      :src="src"
      :class="[props.imageClassName, error && 'invisible']"
      @error="handleLoadError" />
  </div>
</template>
<script setup lang="ts" name="NeteaseImage">
  import { computed, ImgHTMLAttributes, onUnmounted, ref, useAttrs, watch } from "vue";
  import { NeteaseImageSize } from "@mahiru/ui/public/enum";
  import { NeteaseImage as NeteaseImageUtils } from "@mahiru/ui/public/entry/image";
  import { Options, useFileCacheVue } from "@mahiru/ui/public/hooks/useFileCacheVue";
  import { AppScheme, isMainWindow } from "@mahiru/ui/public/utils/dev";
  import { Renderer } from "@mahiru/ui/public/entry/renderer";

  type ShadowLevel = "none" | "base" | "float";
  type ShadowColor = "light" | "dark";
  const shadowMap = {
    float: {
      dark: "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.4)]",
      light: "shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.18)]"
    },
    base: {
      dark: "shadow-sm",
      light: "shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
    },
    none: {
      dark: "",
      light: ""
    }
  } as const;
  const attrs = useAttrs();
  const imageAttrs = computed<ImgHTMLAttributes>(() => ({
    loading: "lazy",
    decoding: "async",
    ...(attrs as any)
  }));
  const props = withDefaults(
    defineProps<{
      src?: string;
      update?: boolean;
      timeLimit?: number;
      method?: string;
      size?: NeteaseImageSize | number;
      imageClassName?: string;
      retryOnError?: boolean;
      retryDelay?: number;
      retryCount?: number;
      shadow?: ShadowLevel;
      shadowColor?: ShadowColor;
      pause?: boolean;
      containerClass?: string;
      preview?: boolean;
    }>(),
    {
      update: false,
      method: "GET",
      size: NeteaseImageSize.raw,
      retryCount: 2,
      retryDelay: 500,
      retryOnError: true,
      shadow: "base",
      shadowColor: "light"
    }
  );
  const emit = defineEmits<{
    (e: "click", event: MouseEvent): void;
  }>();

  const error = ref(false);
  const sizedURL = computed(() => NeteaseImageUtils.setSize(props.src, props.size));
  const cacheURL = computed(() =>
    props.pause ? undefined : NeteaseImageUtils.fetchCacheURL(sizedURL.value)
  );
  const src = computed(() => {
    return props.pause ? undefined : cachedCover.value || cacheURL.value;
  });

  let requestCache: Nullable<(controller?: AbortController) => void> = null;
  const cacheOptions = computed<Options>(() => ({
    update: props.update,
    timeLimit: props.timeLimit,
    method: props.method,
    pause: !!cacheURL.value || props.pause,
    onCacheHit: (file) => {
      NeteaseImageUtils.storeCacheURL(sizedURL.value, file);
    },
    injectCacheRequest: (request) => {
      requestCache = request;
    }
  }));
  const cachedCover = useFileCacheVue(sizedURL, cacheOptions);

  const retryStatus = {
    token: 0,
    count: 0
  };

  function wrapClick(e: MouseEvent) {
    if (props.preview) {
      const imageRawURL = NeteaseImageUtils.setSize(props.src, NeteaseImageSize.raw);
      if (imageRawURL) {
        Renderer.invoke.hasOpenInternalWindow("image").then((opened) => {
          if (!opened) {
            if (isMainWindow()) {
              Renderer.event.openInternalWindow("image");
              Renderer.event.focusInternalWindow("image");
            } else {
              Renderer.sendMessage("playerControl", "main", "openImageWindow");
            }
            Renderer.addMessageHandler(
              "otherWindowLoaded",
              "image",
              () => {
                Renderer.sendMessage("checkImage", "image", {
                  url: imageRawURL,
                  alt: imageAttrs.value.alt
                });
              },
              { id: "imageCheckHandler", once: true }
            );
          } else {
            if (isMainWindow()) {
              Renderer.event.focusInternalWindow("image");
            } else {
              Renderer.sendMessage("playerControl", "main", "openImageWindow");
            }
            Renderer.sendMessage("checkImage", "image", {
              url: imageRawURL,
              alt: imageAttrs.value.alt
            });
          }
        });
      }
    }
    return emit("click", e);
  }

  function onCacheError() {
    NeteaseImageUtils.storeCacheURL(sizedURL.value, null);
  }

  function retry(image: HTMLImageElement) {
    if (!image.isConnected) return; // 图片已不在文档中，停止重试
    if (image.complete && image.naturalWidth > 0) return; // 图片已加载成功，停止重试
    const { count } = retryStatus;
    const { retryCount, retryDelay } = props;
    if (count >= retryCount) return; // 达到最大重试次数，停止重试
    const token = Date.now();
    // Full Jitter
    const delay = Math.random() * retryDelay * (count + 1);
    const canRun = (cb: NormalFunc) => {
      if (!image.isConnected) return;
      else if (token !== retryStatus.token) return;
      else if (image.complete && image.naturalWidth > 0) return;
      cb();
    };
    const exec = () => {
      retryStatus.count += 1;
      const newURL = new URL(sizedURL.value || image.src);
      newURL.searchParams.set("timestamp", Date.now().toString());
      image.src = newURL.toString();
      error.value = false;
    };

    retryStatus.token = token;
    setTimeout(() => {
      requestIdleCallback(() => canRun(exec), { timeout: 200 });
    }, delay);
  }

  function handleLoadError(e: Event) {
    const image = e.currentTarget as HTMLImageElement;
    const canFallback = sizedURL.value && image.src !== sizedURL.value && retryStatus.count === 0;
    if (canFallback) {
      // 如果还没有检查缓存
      if (!cachedCover.value) requestCache?.();

      // 尝试使用原始尺寸图片
      image.src = sizedURL.value!;
      requestIdleCallback(onCacheError, { timeout: 500 });
      return;
    }
    // 已经是原始URL或重试后仍然失败
    error.value = true;
    if (image.src.startsWith(AppScheme)) {
      requestIdleCallback(onCacheError, { timeout: 500 });
    }
    if (props.retryOnError && props.retryCount > 0) {
      retry(image);
    }
  }

  watch(
    () => props.src,
    () => {
      error.value = false;
      retryStatus.token = Date.now();
      retryStatus.count = 0;
    }
  );

  onUnmounted(() => {
    retryStatus.token = Date.now();
  });
</script>
