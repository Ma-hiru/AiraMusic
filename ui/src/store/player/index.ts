import { createZustandShallowStore, createZustandStore } from "../create";
import { PlayerStoreActions, PlayerStoreConfig, PlayerStoreInitialState } from "./config";

const playerStore = createZustandStore(PlayerStoreConfig, "player", true);

export const usePlayerStore = createZustandShallowStore<PlayerStoreType>(playerStore);

export function PlayerStoreSnapshot(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "playerSnapshot", {
      get() {
        return playerStore.getState();
      }
    });
    Object.defineProperty(this.prototype, "audio", {
      get() {
        return playerStore.getState().AudioRefGetter();
      }
    });
  });
}

export type PlayerStoreType = PlayerStoreInitialState & PlayerStoreActions;

export { type PlayerFSMEvent, PlayerFSMStatusEnum } from "./fsm";

export interface WithPlayerSnapshot {
  readonly playerSnapshot: PlayerStoreType;
  readonly audio: Nullable<HTMLAudioElement>;
}
