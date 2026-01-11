import { createZustandShallowStore, createZustandStore } from "../create";
import { PlayerStoreActions, PlayerStoreConfig, PlayerStoreInitialState } from "./config";

const playerStore = createZustandStore(PlayerStoreConfig, "player", true);

export type PlayerStoreType = PlayerStoreInitialState & PlayerStoreActions;

export const usePlayerStore = createZustandShallowStore<PlayerStoreType>(playerStore);

export const getPlayerStoreSnapshot = playerStore.getState.bind(playerStore);

export function AddPlayerStore(_: Function, ctx: ClassDecoratorContext) {
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

export interface WithPlayerStore {
  readonly playerSnapshot: PlayerStoreType;
  readonly audio: Nullable<HTMLAudioElement>;
}
