import { nextFrame } from "@mahiru/ui/public/utils/frame";

export class CacheStoreBase {
  protected encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  protected requestCollections = new Map<string, any[]>();
  protected requestCollectionsProps = new Map<
    string,
    {
      timer: number;
      size: number;
      delay: number;
      flushing: boolean;
      flush: NormalFunc<[collections: any[]]>;
    }
  >();

  protected registerRequestCollection<T>(
    key: string,
    size: number,
    delay: number,
    flush: NormalFunc<[collections: T[]]>
  ) {
    this.requestCollections.set(key, []);
    this.requestCollectionsProps.set(key, {
      timer: 0,
      flushing: false,
      size,
      delay,
      flush
    });
  }

  private flushRequestCollection(key: string) {
    const collection = this.requestCollections.get(key);
    const props = this.requestCollectionsProps.get(key);
    if (!collection || !props) return;
    if (props.flushing) return;
    props.flushing = true;

    props.timer && window.clearTimeout(props.timer);
    nextFrame().then(() => {
      if (collection.length === 0) {
        props.timer = 0;
        props.flushing = false;
        return;
      }
      const newCollection = collection.splice(0, collection.length);
      collection.length = 0;
      props.timer = 0;
      props.flushing = false;
      props.flush(newCollection);
    });
  }

  protected addRequestToCollection<T>(key: string, requestProps: T) {
    const collection = this.requestCollections.get(key);
    const props = this.requestCollectionsProps.get(key);
    if (!collection || !props) return;

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
