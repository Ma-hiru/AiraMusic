function getLinuxDesktop() {
  if (!isLinux) return null;

  const env = (
    process.env.XDG_CURRENT_DESKTOP ||
    process.env.DESKTOP_SESSION ||
    process.env.GDMSESSION ||
    process.env.XDG_SESSION_DESKTOP ||
    ""
  ).toLowerCase();

  if (!env) return null;
  if (env.includes("gnome")) return "gnome";
  if (env.includes("kde") || env.includes("plasma")) return "kde";
  if (env.includes("xfce")) return "xfce";
  if (env.includes("cinnamon")) return "cinnamon";
  if (env.includes("mate")) return "mate";
  if (env.includes("lxde")) return "lxde";
  if (env.includes("lxqt")) return "lxqt";

  return null;
}

export const isWindows = process.platform === "win32";
export const isMacOS = process.platform === "darwin";
export const isLinux = process.platform === "linux";
// 是否创建 MPRIS 支持
export const isCreateMpris = isLinux;
export const linuxDesktop = getLinuxDesktop();
