import { isRef, MaybeRef, onMounted, onUnmounted, unref, watch } from "vue";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

let loaded = false;

function requestLoaded(broadcast = false, hide = false) {
  if (loaded) return;
  loaded = true;
  Renderer.event.loaded({ broadcast, hide });
}

export function useAppLoadedVue(
  condition?: MaybeRef<boolean>,
  props?: MaybeRef<{ broadcast?: boolean; timeout?: number; hide?: boolean }>
) {
  if (unref(condition)) {
    requestLoaded(unref(props)?.broadcast, unref(props)?.hide);
  }
  if (isRef(condition)) {
    const stop = watch(condition, (newCondition) => {
      newCondition && requestLoaded(unref(props)?.broadcast, unref(props)?.hide);
      stop();
    });
  }

  let timer: Undefinable<number>;
  onMounted(() => {
    if (loaded || unref(props)?.timeout === 0) return;
    timer = window.setTimeout(
      () => requestLoaded(unref(props)?.broadcast, unref(props)?.hide),
      unref(props)?.timeout || 10000
    );
  });

  onUnmounted(() => {
    timer && window.clearTimeout(timer);
  });

  return {
    loaded,
    requestLoaded
  };
}
