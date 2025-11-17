import { doLogout, setCookies } from "@mahiru/ui/api/utils/auth";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { userAccount, userDetail, userPlaylist } from "@mahiru/ui/api/user";
import { Log } from "@mahiru/ui/utils/log";
import { EqError } from "@mahiru/ui/utils/err";

const { updatePersistStoreData } = usePersistZustandStore.getState();

export async function login(cookies: string) {
  Log.debug("Logged in successfully, fetching user data...");
  try {
    setCookies(cookies);
    const account = await userAccount();
    const detail = await userDetail(account.profile.userId);
    const playList = await userPlaylist({ uid: account.profile.userId, limit: 30 });
    updatePersistStoreData({
      loginMode: "account",
      user: detail.profile,
      userPlayLists: playList.playlist
    });
  } catch (err) {
    Log.error(
      new EqError({
        label: "ui/utils/login.ts",
        message: "Failed to fetch user data after login.",
        raw: err
      })
    );
    doLogout();
  }
}
