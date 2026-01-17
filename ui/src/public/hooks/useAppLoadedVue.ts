import { isRef, MaybeRef, onMounted, onUnmounted, unref, watch } from "vue";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { Log } from "@mahiru/ui/public/utils/dev";

let loaded = false;

function _requestLoaded(broadcast = false, hide = false) {
  if (loaded) return;
  loaded = true;
  Log.trace("App loaded");
  Renderer.event.loaded({ broadcast, hide });
}

export function useAppLoadedVue(
  condition?: MaybeRef<boolean>,
  props?: MaybeRef<{ broadcast?: boolean; timeout?: number; hide?: boolean }>
) {
  if (unref(condition)) {
    _requestLoaded(unref(props)?.broadcast, unref(props)?.hide);
  }
  if (isRef(condition)) {
    const stop = watch(condition, (newCondition) => {
      newCondition && _requestLoaded(unref(props)?.broadcast, unref(props)?.hide);
      stop();
    });
  }

  let timer: Undefinable<number>;
  onMounted(() => {
    if (loaded || unref(props)?.timeout === 0) return;
    timer = window.setTimeout(
      () => _requestLoaded(unref(props)?.broadcast, unref(props)?.hide),
      unref(props)?.timeout || 10000
    );
    Renderer.addMessageHandler(
      "otherWindowClosed",
      "main",
      () => {
        Renderer.event.close({ broadcast: false });
      },
      { id: "onMainExit" }
    );
  });

  onUnmounted(() => {
    timer && window.clearTimeout(timer);
  });

  function requestLoaded() {
    const param = unref(props);
    _requestLoaded(param?.broadcast, param?.hide);
  }

  return {
    loaded,
    requestLoaded
  };
}
