<template>
  <div
    class="bg-white/10 backdrop-blur-sm border-none overflow-hidden"
    :class="[shadow && shadowMap[shadow][shadowColor], props.containerClass]"
    @click="wrapClick">
    <img
      v-bind="imageAttrs"
      class="w-full h-full object-cover aspect-square"
      :src="(source as Nullable<NeteaseNetworkImage | NeteaseLocalImage>)?.src"
      :alt="imageAttrs.alt ?? (source as Nullable<NeteaseNetworkImage | NeteaseLocalImage>)?.alt"
      :class="[props.imageClassName, error && 'invisible']"
      @error="handleLoadError" />
  </div>
</template>
<script setup lang="ts" name="NeteaseImage">
  import { computed, ImgHTMLAttributes, onUnmounted, ref, useAttrs, watch } from "vue";
  import { NeteaseLocalImage, NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";

  import { NeteaseImageSize } from "@mahiru/ui/public/enum";
  import NeteaseServices from "@mahiru/ui/public/source/netease/services";
  import ElectronServices from "@mahiru/ui/public/source/electron/services";

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
      imageClassName?: string;
      retryOnError?: boolean;
      retryDelay?: number;
      retryCount?: number;
      shadow?: ShadowLevel;
      shadowColor?: ShadowColor;
      pause?: boolean;
      preview?: boolean;
      image: Optional<NeteaseNetworkImage | NeteaseLocalImage>;
      cache: boolean;
      containerClass?: string;
    }>(),
    {
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
  const source = ref<Optional<NeteaseNetworkImage | NeteaseLocalImage>>(null);
  const retryStatus = {
    token: 0,
    count: 0
  };

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
      const newURL = new URL(image.src);
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
    const data = source.value as Nullable<NeteaseNetworkImage | NeteaseLocalImage>;

    if (data?.isLocal && props.image) {
      source.value = props.image.toNetworkImage();
    } else if (data?.isNetwork && props.retryOnError) {
      retry(e.target as HTMLImageElement);
    }

    return imageAttrs.value.onError?.(e as any);
  }

  async function wrapClick(e: MouseEvent) {
    if (props.preview && props.image) {
      const imageWindow = ElectronServices.Window.from("image");
      const sendImage = props.image.toNetworkImage().setSize(NeteaseImageSize.raw);
      await imageWindow.openAwait();
      imageWindow.focus();
      imageWindow.send("imageCheckerBus", {
        url: sendImage.src,
        alt: imageAttrs.value.alt ?? sendImage.alt
      });
    }
    return emit("click", e);
  }

  watch(
    () => props.image,
    () => {
      error.value = false;
      retryStatus.token = Date.now();
      retryStatus.count = 0;
    }
  );

  watch(
    [() => props.pause, () => props.image?.src],
    () => {
      if (!props.image) return;
      NeteaseServices.Image.local(props.image, props.cache).then((local) => {
        if (local) {
          source.value = local;
        } else {
          source.value = props.image;
        }
      });
    },
    { immediate: true }
  );

  onUnmounted(() => {
    retryStatus.token = Date.now();
  });
</script>
