import { debounce } from "lodash-es";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { MaybeRef, onMounted, onUnmounted, ref, unref, watch } from "vue";
import { UI } from "@mahiru/ui/public/entry/ui";

export function useThemeSyncReceiveVue(useCSSVar: MaybeRef<boolean> = false) {
  const themeSync = ref<ThemeSync>({
    secondaryColor: UI.APPThemeColorDefault.secondary,
    mainColor: UI.APPThemeColorDefault.main,
    KMeansColor: [UI.APPThemeColorDefault.main, UI.APPThemeColorDefault.secondary],
    textColorOnMain: UI.APPThemeColorDefault.textOnMain,
    backgroundImage: undefined
  });

  let unsubscribable: Undefinable<NormalFunc>;
  onMounted(() => {
    requestThemeSync();
    unsubscribable = Renderer.addMessageHandler("themeSync", "main", (data) => {
      themeSync.value = data;
    });
  });
  onUnmounted(() => {
    unsubscribable?.();
  });

  watch(
    themeSync,
    () => {
      const useVar = unref(useCSSVar);
      let { main, textOnMain, secondary } = UI.APPThemeColorDefault;
      if (useVar) {
        main = themeSync.value.mainColor;
        textOnMain = themeSync.value.textColorOnMain;
        secondary = themeSync.value.secondaryColor;
      }

      document.documentElement.style.setProperty(UI.APPMainColorVarsName, main);
      document.documentElement.style.setProperty(UI.APPTextColorOnMainColorVarsName, textOnMain);
      document.documentElement.style.setProperty(UI.APPSecondaryColorVarsName, secondary);
    },
    { immediate: true }
  );

  return { themeSync, requestThemeSync };
}

const requestThemeSync = debounce(() => {
  Renderer.sendMessage("requestThemeSync", "main", undefined);
}, 500);
