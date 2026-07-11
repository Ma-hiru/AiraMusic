export interface NativeAddon {
  setLivePreview(handle: Buffer, preview: Uint8Array): void;
  setCover(handle: Buffer, image: Nullable<Uint8Array>, preview?: Nullable<Uint8Array>): void;
}
