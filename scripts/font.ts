import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontDir = join(__dirname, "../ui/public/fonts");
const outDir = join(__dirname, "../ui/src/styles/font.scss");
const head = "// Auto generated. DO NOT EDIT.\n";
const content = fs.opendirSync(fontDir);
const scss = <string[]>[];
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

for await (const entry of content) {
  if (entry.isDirectory()) {
    const fontName = entry.name.replaceAll("_", " ");
    const files = fs.readdirSync(join(fontDir, entry.name)).filter((f) => f.includes("_"));
    const content = files.reduce((initial, file) => {
      initial += gen(fontName, file, level.find((l) => file.includes(l.name))!.weight!);
      return initial;
    }, "");
    scss.push(content);
  }
}

const final = head + scss.join("");
fs.writeFileSync(outDir, final, "utf-8");
