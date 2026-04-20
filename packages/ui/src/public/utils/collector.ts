import { Log } from "@mahiru/ui/public/utils/dev";

export class RequestCollector {
  private static readonly requestCollections = new Map<string, any[]>();
  private static readonly requestCollectionsProps = new Map<
    string,
    {
      timer: number;
      size: number;
      delay: number;
      flushing: boolean;
      flush: NormalFunc<[collections: any[]]>;
    }
  >();

  private static flush(key: string) {
    const collection = this.requestCollections.get(key);
    const props = this.requestCollectionsProps.get(key);
    if (!collection || !props) return;
    // 如果正在flush，则直接返回
    if (props.flushing) return;
    props.flushing = true;
    // 如果有定时器(timer !== 0)，则清除定时器
    props.timer && window.clearTimeout(props.timer);
    // 如果没有数据，则直接返回
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
  }

  static register<T>(
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

  static add<T>(key: string, requestProps: T) {
    const collection = this.requestCollections.get(key);
    const props = this.requestCollectionsProps.get(key);
    // 如果没有注册，则直接返回
    if (!collection || !props) {
      Log.warn(`RequestCollector: ${key} is not registered`);
      return;
    }

    collection.push(requestProps);
    // 超过大小，立即flush
    if (collection.length >= props.size) this.flush(key);
    // 如果没有定时器，则设置定时器，超时后flush
    if (props.timer === 0) {
      props.timer = window.setTimeout(() => {
        this.flush(key);
      }, props.delay);
    }
  }
}
