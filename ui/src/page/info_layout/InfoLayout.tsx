import { FC, memo, useState } from "react";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import { useNavigate } from "react-router-dom";
import InfoTop from "./InfoTop";
import { InfoCtx } from "@mahiru/ui/ctx/InfoCtx";

const InfoLayout: FC<object> = () => {
  const [show, setShow] = useState(false);
  const [infoSync, setInfoSync] = useState<InfoSync>({
    type: "none",
    id: 0,
    mainColor: "",
    secondaryColor: "",
    textColor: ""
  });

  const navigate = useNavigate();

  return (
    <div className="w-screen h-screen bg-white overflow-hidden">
      <InfoTop />
      <InfoCtx.Provider value={infoSync}>
        <KeepAliveOutlet />;
      </InfoCtx.Provider>
    </div>
  );
};
export default memo(InfoLayout);
