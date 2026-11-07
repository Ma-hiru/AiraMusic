import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import sharp from "sharp";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const AssetsDir = join(__dirname, "../packages/app/assets");

/** 菜单栏模板图标边长（2x），绘制时缩到 14pt 左右 */
const MENUBAR_ICON_SIZE = 36;
/** 符号在画布内的有效边长，留出抗锯齿余量 */
const MENUBAR_ICON_CONTENT = 34;

export async function generateLogo() {
  await Promise.all([generateAppLogo(), generateMenuBarIcon()]);
  console.log("[generate logo]", "done");
}

/** 应用图标：带渐变底色，用于 Dock / 任务栏 / 安装包 */
async function generateAppLogo() {
  const svg = fs.readFileSync(join(AssetsDir, "logo.svg"));
  await sharp(svg).resize(512, 512).png().toFile(join(AssetsDir, "logo.png"));
}

/**
 * 菜单栏模板图标：只保留唱片符号，透明底、纯黑填充 \
 * macOS 菜单栏按 alpha 取形状、系统按亮暗上色，配色由绘制侧决定而不是图片本身
 */
async function generateMenuBarIcon() {
  const svg = fs.readFileSync(join(AssetsDir, "menubar.svg"));
  const glyph = await sharp(svg)
    .trim({ threshold: 1 })
    .resize(MENUBAR_ICON_CONTENT, MENUBAR_ICON_CONTENT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: MENUBAR_ICON_SIZE,
      height: MENUBAR_ICON_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: glyph, gravity: "center" }])
    .png()
    .toFile(join(AssetsDir, "menubar.png"));
}
