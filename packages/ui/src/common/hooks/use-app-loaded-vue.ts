import { type MaybeRef, onMounted, unref, watch } from "vue";
import { ElectronServicesWindow } from "@/common/source/electron/services";

let loaded = false;

export function useAppLoadedVue(condition?: MaybeRef<boolean>) {
  if (loaded) return;
  if (condition === undefined) {
    onMounted(() => {
      loaded = true;
      ElectronServicesWindow.current.show();
    });
  } else {
    let stop: NormalFunc | null = null;
    stop = watch(
      () => unref(condition),
      (value) => {
        if (!value) return;

        loaded = true;
        ElectronServicesWindow.current.show();
        stop?.();
      },
      { immediate: true }
    );
  }
}
