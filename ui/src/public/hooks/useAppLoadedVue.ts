import { MaybeRef, onMounted, unref, watch } from "vue";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

let loaded = false;

export function useAppLoadedVue(condition?: MaybeRef<boolean>) {
  if (loaded) return;
  if (condition === undefined) {
    onMounted(() => {
      loaded = true;
      ElectronServices.Window.current.show();
    });
  } else {
    let stop: NormalFunc | null = null;
    stop = watch(
      () => unref(condition),
      (value) => {
        if (!value) return;

        loaded = true;
        ElectronServices.Window.current.show();
        stop?.();
      },
      { immediate: true }
    );
  }
}
