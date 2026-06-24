export interface NativeAddon {
  setCover(handle: Buffer, image: Nullable<Uint8Array>, preview?: Nullable<Uint8Array>): void;
}
