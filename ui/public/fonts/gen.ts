import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

const level = [
  {
    name: "Thin",
    weight: 100
  },
  {
    name: "Light",
    weight: 300
  },
  {
    name: "Regular",
    weight: 400
  },
  {
    name: "Medium",
    weight: 500
  },
  {
    name: "Bold",
    weight: 700
  },
  {
    name: "Black",
    weight: 900
  }
];
function gen(fontName: string, fileName: string, weight: number) {
  return `
@font-face {
  font-family: "${fontName}";
  src: url("/fonts/${fontName.replaceAll(" ", "_")}/${fileName}") format("truetype");
  font-weight: ${weight};
  font-display: swap;
  font-style: ${fontName.includes("Italic") ? "italic" : "normal"};
}
`;
}
const dir = dirname(fileURLToPath(new URL(import.meta.url)));
const content = fs.opendirSync(dir);
const scss = <string[]>[];
for await (const entry of content) {
  if (entry.isDirectory()) {
    const fontName = entry.name.replaceAll("_", " ");
    const files = fs.readdirSync(join(dir, entry.name)).filter((f) => f.includes("_"));
    const content = files.reduce((initial, file) => {
      initial += gen(fontName, file, level.find((l) => file.includes(l.name))!.weight!);
      return initial;
    }, "");
    scss.push(content);
  }
}
const head = "// Auto generated. DO NOT EDIT.\n";
const final = head + scss.join("");
fs.writeFileSync(fileURLToPath(new URL("./font.scss", import.meta.url)), final, "utf-8");
