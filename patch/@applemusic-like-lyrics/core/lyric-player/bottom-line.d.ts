import { Disposable, HasElement } from "../interfaces.d.ts";
import { Spring } from "../utils/spring.d.ts";
import { LyricPlayerBase } from "./base.d.ts";
export declare class BottomLineEl implements HasElement, Disposable {
  private lyricPlayer;
  private element;
  private left;
  private top;
  private delay;
  lineSize: [number, number];
  readonly lineTransforms: {
    posX: Spring;
    posY: Spring;
  };
  constructor(lyricPlayer: LyricPlayerBase);
  measureSize(): Promise<[number, number]>;
  private lastStyle;
  show(): void;
  hide(): void;
  private rebuildStyle;
  getElement(): HTMLElement;
  setTransform(left?: number, top?: number, force?: boolean, delay?: number): void;
  update(delta?: number): void;
  get isInSight(): boolean;
  dispose(): void;
}
//# sourceMappingURL=bottom-line.d.ts.map
