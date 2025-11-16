import { setCookies } from "@mahiru/ui/api/utils/auth";
import { usePersistZustandStore } from "@mahiru/ui/store";
import { userAccount, userDetail, userPlaylist } from "@mahiru/ui/api/user";
import { Log } from "@mahiru/ui/utils/log";

const { updatePersistStoreData } = usePersistZustandStore.getState();
export async function login(cookies: string) {
  Log.debug("Logged in successfully, invoking login with cookies.");
  setCookies(cookies);
  const account = await userAccount();
  console.log("account", account);
  const detail = await userDetail(account.profile.userId);
  console.log("detail", detail);
  const playList = userPlaylist({ uid: account.profile.userId, limit: 30 });
  console.log("playList", playList);
}
