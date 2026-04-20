export class CacheStoreUtils {
  static encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  static get BLANK_INDEX() {
    return {
      id: "",
      url: "",
      path: "",
      file: "",
      name: "",
      type: "",
      size: "",
      createTime: 0,
      eTag: "",
      lastModified: ""
    } satisfies CacheStoreIndex;
  }
}
