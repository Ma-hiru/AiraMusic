import { useCallback } from "react";
import { useSettings, settingsStoreSnapshot } from "@/common/store/settings";

export function usePlaylistLayout() {
  const legacy = !!useSettings().preference.useLegacyPlaylistLayout;
  const toggleLayout = useCallback(() => {
    const { _settings, updateSettings } = settingsStoreSnapshot();
    updateSettings({
      ..._settings,
      preference: {
        ..._settings.preference,
        useLegacyPlaylistLayout: !_settings.preference.useLegacyPlaylistLayout
      }
    });
  }, []);

  return { legacy, toggleLayout };
}
