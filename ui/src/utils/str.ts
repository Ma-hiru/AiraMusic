export function splitTrackTitle(title?: string) {
  if (!title) return { main: "", sub: "" };
  const regex = /^(.*?)\s*(\([^()]*\)|（[^（）]*）|\[[^[\]]*]|【[^【】]*】|-[^-\s][^-]*-)\s*$/;
  const match = title.match(regex);
  if (!match) {
    return {
      main: title.trim(),
      sub: ""
    };
  }
  return {
    main: match[1]?.trim() || "",
    sub: match[2]?.trim() || ""
  };
}
