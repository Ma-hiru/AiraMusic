import { Log } from "@mahiru/ui/common/constants/dev";

let cityCodeMap: Nullable<Record<number | string, string>> = null;

const init = async () => {
  cityCodeMap = await fetch(`${import.meta.env.BASE_URL}data/city-code.json`)
    .then((res) => res.json())
    .catch((err) => {
      Log.error("CityCode", "city-code fetch error", err);
      return null;
    });
};

export async function getCityNameByCode(code: Optional<number | string>) {
  if (!code) return null;
  if (!cityCodeMap) await init();
  return cityCodeMap?.[code] ?? null;
}
