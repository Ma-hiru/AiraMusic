import { MaybeRef, onMounted, unref, watch } from "vue";
import AppWindow from "@mahiru/ui/public/entry/window";

let loaded = false;

export function useAppLoadedVue(condition?: MaybeRef<boolean>) {
  if (loaded) return;
  if (condition === undefined) {
    onMounted(() => {
      loaded = true;
      AppWindow.current.show();
    });
  } else {
    let stop: NormalFunc | null = null;
    stop = watch(
      () => unref(condition),
      (value) => {
        if (!value) return;

        loaded = true;
        AppWindow.current.show();
        stop?.();
      },
      { immediate: true }
    );
  }
}
