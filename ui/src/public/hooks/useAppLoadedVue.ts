import { MaybeRef, unref, watch } from "vue";
import AppWindow from "@mahiru/ui/public/entry/window";

let loaded = false;

export function useAppLoadedVue(condition?: MaybeRef<boolean>) {
  if (loaded) return;
  let stop: NormalFunc | null = null;
  stop = watch(
    () => unref(condition) ?? true,
    (value) => {
      if (!value) return;

      loaded = true;
      AppWindow.current.show();
      stop?.();
    },
    { immediate: true }
  );
}
