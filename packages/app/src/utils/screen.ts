import { screen, Display } from "electron";
import { AppWindowConstants } from "../constant/win";

export default class AppScreen {
  private display: Display;

  private constructor(display: Display) {
    this.display = display;
  }

  get logicalScreenSize() {
    return this.display.size;
  }

  get logicalWorkAreaSize() {
    return this.display.workAreaSize;
  }

  get scaleFactor() {
    return this.display.scaleFactor;
  }

  get physicalScreenSize() {
    const { width, height } = this.display.size;
    const sf = this.display.scaleFactor;
    return {
      width: Math.floor(width * sf),
      height: Math.floor(height * sf)
    };
  }

  get physicalWorkAreaSize() {
    const { width, height } = this.display.workAreaSize;
    const sf = this.display.scaleFactor;
    return {
      width: Math.floor(width * sf),
      height: Math.floor(height * sf)
    };
  }

  getAreaBounds(
    coverRatio = AppWindowConstants.DEFAULT_WINDOW_COVER_RATIO,
    widthHeightRatio = AppWindowConstants.DEFAULT_WINDOW_WIDTH_HEIGHT_RATIO
  ) {
    const { width, height } = this.logicalWorkAreaSize;
    const targetHeight = Math.floor(height * coverRatio);
    const targetWidth = Math.floor(targetHeight * widthHeightRatio);

    if (targetWidth < width) {
      return {
        width: targetWidth,
        height: targetHeight
      };
    } else {
      const adjustedWidth = Math.floor(width * coverRatio);
      const adjustedHeight = Math.floor(adjustedWidth / widthHeightRatio);
      return {
        width: adjustedWidth,
        height: adjustedHeight
      };
    }
  }

  static get primary() {
    return new AppScreen(screen.getPrimaryDisplay());
  }

  static getAllScreens() {
    return screen.getAllDisplays().map((display) => new AppScreen(display));
  }

  static isOutScreenDIPBounds(x?: number, y?: number) {
    return !(
      typeof x === "number" &&
      typeof y === "number" &&
      screen
        .getAllDisplays()
        .some(
          ({ bounds }) =>
            x > bounds.x &&
            x < bounds.x + bounds.width &&
            y > bounds.y &&
            y < bounds.y + bounds.height
        )
    );
  }

  [Symbol.toPrimitive]() {
    return `
   Display of ${this.display.id}
     Info:
           Primary: ${screen.getPrimaryDisplay().id === this.display.id ? "Yes" : "No"}
           Internal: ${this.display.internal ? "Yes" : "No"}
           Position: (${this.display.bounds.x}, ${this.display.bounds.y})
           Rotation: ${this.display.rotation}°
           Scale Factor: ${this.display.scaleFactor}
           Size: ${this.display.size.width}@${this.display.size.height}
           Touch Support: ${this.display.touchSupport}
     Bounds:
           X:      ${this.display.bounds.x}
           Y:      ${this.display.bounds.y}
           Width:  ${this.display.bounds.width}
           Height: ${this.display.bounds.height}
     Logical Work Area:
           X:      ${this.display.workArea.x}
           Y:      ${this.display.workArea.y}
           Width:  ${this.display.workArea.width}
           Height: ${this.display.workArea.height}
     Logical Work Area Size:
           Width:  ${this.display.workAreaSize.width}
           Height: ${this.display.workAreaSize.height}
     Color Properties:
           Color Depth: ${this.display.colorDepth}
           Color Space: ${this.display.colorSpace}
  `;
  }
}
