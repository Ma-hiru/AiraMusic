import { FC, memo } from "react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";

const AvatarMini: FC<object> = () => {
  const { data } = usePersistZustandShallowStore(["data"]);
  return (
    <div>
      <img className="size-6 rounded-full" src={data.user?.avatarUrl} alt={data.user?.nickname} />
    </div>
  );
};
export default memo(AvatarMini);
