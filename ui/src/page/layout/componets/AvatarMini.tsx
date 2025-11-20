import { FC, memo, useEffect, useState } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";

const AvatarMini: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const [avatar, setAvatar] = useState("");
  useEffect(() => {
    data.user?.avatarUrl && setAvatar(wrapCacheUrl(data.user.avatarUrl));
  }, [data.user?.avatarUrl]);
  return (
    <div>
      <img className="size-6 rounded-full" src={avatar} alt={data.user?.nickname} />
    </div>
  );
};
export default memo(AvatarMini);
