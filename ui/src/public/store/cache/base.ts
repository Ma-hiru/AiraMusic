import { nextFrame } from "@mahiru/ui/public/utils/frame";

export class CacheStoreBase {
  protected encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  protected requestCollections = new Map<string, any[]>();
  protected requestCollectionsProps = new Map<
    string,
    { timer: number; size: number; delay: number; flush: NormalFunc<[collections: any[]]> }
  >();

  protected registerRequestCollection<T>(
    key: string,
    size: number,
    delay: number,
    flush: NormalFunc<[collections: T[]]>
  ) {
    this.requestCollections.set(key, []);
    this.requestCollectionsProps.set(key, { timer: 0, size, delay, flush });
  }

  private flushRequestCollection(key: string) {
    const collection = this.requestCollections.get(key);
    const props = this.requestCollectionsProps.get(key);
    if (!collection || !props) return;

    props.timer && window.clearTimeout(props.timer);
    props.timer = 0;

    nextFrame().then(() => {
      if (collection.length === 0) return;
      const newCollection = [...collection];
      collection.length = 0;
      props.flush(newCollection);
    });
  }

  protected addRequestToCollection<T>(key: string, requestProps: T) {
    const collection = this.requestCollections.get(key);
    const props = this.requestCollectionsProps.get(key);
    if (!collection || !props) return false;

    collection.push(requestProps);

    if (collection.length >= props.size) {
      this.flushRequestCollection(key);
    }
    if (props.timer === 0) {
      props.timer = window.setTimeout(() => {
        this.flushRequestCollection(key);
      }, props.delay);
    }
  }

  protected get BLANK_INDEX() {
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
