declare module "@mahiru/native" {
  export function clearThumbnail(): void;
  export function destroyTaskbar(): void;

  export function initTaskbar(hwndBuffer: Buffer): void;

  export function setButtonEnabled(button: "prev" | "play" | "next", enabled: boolean): void;

  export function setThumbCallback(callback: (err: Error | null, arg: string) => any): void;

  export function setThumbIcons(
    prevIcon: Buffer,
    playIcon: Buffer,
    pauseIcon: Buffer,
    nextIcon: Buffer
  ): void;

  export function setThumbnailImage(rgbaData: Buffer, width: number, height: number): void;

  export function updatePlayState(isPlaying: boolean): void;
}
