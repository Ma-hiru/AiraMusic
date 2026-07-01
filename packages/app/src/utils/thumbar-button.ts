import { nativeImage } from "electron";

export type TaskbarButtonIcon = "next" | "play" | "pause" | "previous";

function createControlIcon(icon: TaskbarButtonIcon) {
  const size = 32;
  const color = [248, 250, 252, 255] as const;
  const bitmap = Buffer.alloc(size * size * 4);

  const setPixel = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (y * size + x) * 4;
    bitmap[offset] = color[2];
    bitmap[offset + 1] = color[1];
    bitmap[offset + 2] = color[0];
    bitmap[offset + 3] = color[3];
  };

  const fillRect = (left: number, top: number, width: number, height: number) => {
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        setPixel(x, y);
      }
    }
  };

  const fillPolygon = (points: [number, number][]) => {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const minX = Math.floor(Math.min(...xs));
    const maxX = Math.ceil(Math.max(...xs));
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil(Math.max(...ys));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i]!;
          const [xj, yj] = points[j]!;
          const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
          if (crosses) inside = !inside;
        }
        if (inside) setPixel(x, y);
      }
    }
  };

  switch (icon) {
    case "previous":
      fillRect(8, 8, 3, 17);
      fillPolygon([
        [23, 7],
        [11, 16],
        [23, 25]
      ]);
      break;
    case "play":
      fillPolygon([
        [11, 7],
        [24, 16],
        [11, 25]
      ]);
      break;
    case "pause":
      fillRect(10, 8, 5, 17);
      fillRect(18, 8, 5, 17);
      break;
    case "next":
      fillRect(22, 8, 3, 17);
      fillPolygon([
        [9, 7],
        [22, 16],
        [9, 25]
      ]);
      break;
  }

  return nativeImage.createFromBitmap(bitmap, { width: size, height: size, scaleFactor: 1 });
}

export function getThumbarIcons() {
  return {
    previous: createControlIcon("previous"),
    play: createControlIcon("play"),
    pause: createControlIcon("pause"),
    next: createControlIcon("next")
  };
}
