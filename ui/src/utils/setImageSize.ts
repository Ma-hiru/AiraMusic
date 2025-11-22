export function setImageURLSize(url: Undefinable<string>, size: "xs" | "sm" | "md" | "lg" | "raw") {
  if (!url) return url;
  const u = new URL(url);
  let param;
  switch (size) {
    case "xs":
      param = "50y50";
      break;
    case "sm":
      param = "100y100";
      break;
    case "md":
      param = "250y250";
      break;
    case "lg":
      param = "500y500";
      break;
    default:
      return u.toString();
  }
  u.searchParams.append("param", param);
  return u.toString();
}
