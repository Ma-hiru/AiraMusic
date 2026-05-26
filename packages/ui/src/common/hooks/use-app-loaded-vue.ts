import { type MaybeRef, onMounted, unref, watch } from "vue";
import { RendererWindow } from "@/common/lib/window";

let loaded = false;

export function useAppLoadedVue(condition?: MaybeRef<boolean>) {
  if (loaded) return;
  if (condition === undefined) {
    onMounted(() => {
      loaded = true;
      RendererWindow.current.show();
    });
  } else {
    let stop: NormalFunc | null = null;
    stop = watch(
      () => unref(condition),
      (value) => {
        if (!value) return;

        loaded = true;
        RendererWindow.current.show();
        stop?.();
      },
      { immediate: true }
    );
  }
}
